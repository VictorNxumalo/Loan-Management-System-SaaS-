import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DisbursementStatus, StitchDisbursementStatus } from '@prisma/client';
import { randomUUID } from 'crypto';
import type { LoanStitchDisbursementDto } from '@lms/types';
import { AuditService } from '../audit/audit.service';
import { formatCents } from '../common/money';
import { NotificationDispatchService } from '../notifications/notification-dispatch.service';
import { PrismaService } from '../prisma/prisma.service';
import { maskAccountNumber, resolveStitchBankId } from './stitch-bank.util';
import { StitchDisbursementService } from './stitch-disbursement.service';
import { isStitchDisbursementsEnabled } from '../config/env';

@Injectable()
export class StitchLoanDisbursementService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stitchDisbursement: StitchDisbursementService,
    private readonly auditService: AuditService,
    private readonly notificationDispatch: NotificationDispatchService,
  ) {}

  isEnabled(): boolean {
    return isStitchDisbursementsEnabled();
  }

  mapDto(row: {
    id: string;
    status: StitchDisbursementStatus;
    statusReason: string | null;
    stitchDisbursementId: string | null;
    amountCents: number;
    beneficiaryName: string;
    beneficiaryBankId: string;
    beneficiaryAccountNumber: string;
    disbursementType: string;
    createdAt: Date;
    updatedAt: Date;
    lastWebhookAt: Date | null;
  }): LoanStitchDisbursementDto {
    return {
      id: row.id,
      status: row.status,
      statusReason: row.statusReason,
      stitchDisbursementId: row.stitchDisbursementId,
      amountFormatted: formatCents(row.amountCents),
      beneficiaryName: row.beneficiaryName,
      beneficiaryBankId: row.beneficiaryBankId,
      beneficiaryAccountNumberMasked: maskAccountNumber(row.beneficiaryAccountNumber),
      disbursementType: row.disbursementType,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      lastWebhookAt: row.lastWebhookAt?.toISOString() ?? null,
    };
  }

  /**
   * Initiate a real Stitch payout to the borrower's linked bank account.
   * Does not move internal wallet balances — settlement is via Stitch float + webhooks.
   */
  async initiateLoanDisbursement(
    orgId: string,
    userId: string,
    loanId: string,
  ): Promise<void> {
    if (!this.isEnabled()) {
      throw new BadRequestException('Stitch disbursements are not enabled');
    }

    const pending = await this.prisma.withOrgContext(orgId, userId, async (tx) => {
      const loan = await tx.loan.findFirst({
        where: { id: loanId, orgId, deletedAt: null },
        include: {
          stitchDisbursement: true,
          loanApplication: { select: { borrowerUserId: true } },
          borrower: { select: { fullName: true, platformUserId: true } },
        },
      });

      if (!loan) {
        throw new NotFoundException('Loan not found');
      }

      if (loan.disbursementStatus === DisbursementStatus.COMPLETED) {
        throw new BadRequestException('Loan has already been disbursed');
      }

      if (
        loan.disbursementStatus === DisbursementStatus.PENDING ||
        loan.stitchDisbursement?.status === StitchDisbursementStatus.SUBMITTED ||
        loan.stitchDisbursement?.status === StitchDisbursementStatus.PAUSED
      ) {
        throw new BadRequestException(
          'A disbursement is already in progress for this loan',
        );
      }

      const borrowerUserId =
        loan.borrower.platformUserId ?? loan.loanApplication?.borrowerUserId;

      if (!borrowerUserId) {
        throw new BadRequestException(
          'Borrower is not linked to a platform account; cannot disburse to bank',
        );
      }

      const borrowerWallet = await tx.wallet.findFirst({
        where: { ownerUserId: borrowerUserId },
        include: { bankAccount: true },
      });

      const bank = borrowerWallet?.bankAccount;
      if (!bank) {
        throw new BadRequestException(
          'Borrower has no linked bank account on their profile. They must complete wallet/bank details before disbursement.',
        );
      }

      const nonce = randomUUID();
      const externalReference = `loan:${loanId}`;

      const record = await tx.loanStitchDisbursement.create({
        data: {
          loanId,
          orgId,
          nonce,
          externalReference,
          amountCents: loan.principalCents,
          status: StitchDisbursementStatus.PENDING,
          beneficiaryName: bank.accountHolder || loan.borrower.fullName,
          beneficiaryAccountNumber: bank.accountNumber,
          beneficiaryBankId: resolveStitchBankId(bank.bankName),
          beneficiaryReference: `LMS ${loanId.slice(0, 8)}`,
          disbursementType: 'default',
          createdByUserId: userId,
        },
      });

      await tx.loan.update({
        where: { id: loanId },
        data: { disbursementStatus: DisbursementStatus.PENDING },
      });

      return {
        record,
        loan,
        bank,
      };
    });

    try {
      const stitch = await this.stitchDisbursement.createDisbursement({
        amountCents: pending.record.amountCents,
        nonce: pending.record.nonce,
        externalReference: pending.record.externalReference,
        beneficiaryReference: pending.record.beneficiaryReference,
        beneficiaryName: pending.record.beneficiaryName,
        beneficiaryAccountNumber: pending.record.beneficiaryAccountNumber,
        beneficiaryBankName: pending.bank.bankName,
      });

      await this.prisma.withOrgContext(orgId, userId, async (tx) => {
        await tx.loanStitchDisbursement.update({
          where: { id: pending.record.id },
          data: {
            stitchDisbursementId: stitch.id,
            status: this.mapStitchStatus(stitch.status),
            statusReason: stitch.statusReason ?? null,
          },
        });

        await this.auditService.record(tx, {
          orgId,
          userId,
          action: 'loan.disbursement.submitted',
          entityType: 'LOAN',
          entityId: loanId,
          after: {
            stitchDisbursementId: stitch.id,
            amountCents: pending.record.amountCents,
            status: stitch.status,
          },
        });
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Stitch disbursement failed';
      await this.prisma.withOrgContext(orgId, userId, async (tx) => {
        await tx.loanStitchDisbursement.update({
          where: { id: pending.record.id },
          data: {
            status: StitchDisbursementStatus.ERROR,
            statusReason: message.slice(0, 500),
          },
        });
        await tx.loan.update({
          where: { id: loanId },
          data: { disbursementStatus: DisbursementStatus.FAILED },
        });
      });
      throw err;
    }
  }

  async applyWebhookUpdate(payload: {
    stitchDisbursementId?: string;
    externalReference?: string;
    status: string;
    statusReason?: string;
  }): Promise<void> {
    const record = await this.prisma.loanStitchDisbursement.findFirst({
      where: payload.stitchDisbursementId
        ? { stitchDisbursementId: payload.stitchDisbursementId }
        : payload.externalReference
          ? { externalReference: payload.externalReference }
          : undefined,
      include: {
        loan: {
          include: {
            borrower: true,
            organisation: true,
            loanApplication: { select: { borrowerUserId: true } },
          },
        },
      },
    });

    if (!record) {
      return;
    }

    const mapped = this.mapStitchStatus(payload.status);
    const now = new Date();
    let disbursementNotify: {
      orgId: string;
      loanId: string;
      borrowerUserId: string;
      borrowerName: string;
      organisationName: string;
      amountCents: number;
    } | null = null;

    await this.prisma.withOrgContext(
      record.orgId,
      record.createdByUserId,
      async (tx) => {
        await tx.loanStitchDisbursement.update({
          where: { id: record.id },
          data: {
            status: mapped,
            statusReason: payload.statusReason?.slice(0, 500) ?? record.statusReason,
            lastWebhookAt: now,
            ...(payload.stitchDisbursementId && !record.stitchDisbursementId
              ? { stitchDisbursementId: payload.stitchDisbursementId }
              : {}),
          },
        });

        if (mapped === StitchDisbursementStatus.COMPLETED) {
          await tx.loan.update({
            where: { id: record.loanId },
            data: {
              disbursementStatus: DisbursementStatus.COMPLETED,
              disbursedAt: now,
            },
          });

          await this.auditService.record(tx, {
            orgId: record.orgId,
            userId: record.createdByUserId,
            action: 'loan.disbursed',
            entityType: 'LOAN',
            entityId: record.loanId,
            after: {
              stitchDisbursementId: record.stitchDisbursementId ?? payload.stitchDisbursementId,
              amountCents: record.amountCents,
              provider: 'STITCH',
            },
          });

          const borrowerUserId =
            record.loan.borrower.platformUserId ??
            record.loan.loanApplication?.borrowerUserId;

          if (borrowerUserId) {
            disbursementNotify = {
              orgId: record.orgId,
              loanId: record.loanId,
              borrowerUserId,
              borrowerName: record.loan.borrower.fullName,
              organisationName: record.loan.organisation.name,
              amountCents: record.amountCents,
            };
          }
        } else if (
          mapped === StitchDisbursementStatus.ERROR ||
          mapped === StitchDisbursementStatus.CANCELLED ||
          mapped === StitchDisbursementStatus.REVERSED
        ) {
          await tx.loan.update({
            where: { id: record.loanId },
            data: { disbursementStatus: DisbursementStatus.FAILED },
          });
        } else if (
          mapped === StitchDisbursementStatus.SUBMITTED ||
          mapped === StitchDisbursementStatus.PAUSED
        ) {
          await tx.loan.update({
            where: { id: record.loanId },
            data: { disbursementStatus: DisbursementStatus.PENDING },
          });
        }
      },
    );

    if (disbursementNotify) {
      void this.notificationDispatch.notifyLoanDisbursed(disbursementNotify);
    }
  }

  private mapStitchStatus(stitchStatus: string): StitchDisbursementStatus {
    const normalized = stitchStatus.toLowerCase().replace(/^disbursement/, '');
    switch (normalized) {
      case 'pending':
      case 'submitted':
        return StitchDisbursementStatus.SUBMITTED;
      case 'completed':
        return StitchDisbursementStatus.COMPLETED;
      case 'error':
        return StitchDisbursementStatus.ERROR;
      case 'paused':
        return StitchDisbursementStatus.PAUSED;
      case 'cancelled':
        return StitchDisbursementStatus.CANCELLED;
      case 'reversed':
        return StitchDisbursementStatus.REVERSED;
      default:
        return StitchDisbursementStatus.SUBMITTED;
    }
  }
}
