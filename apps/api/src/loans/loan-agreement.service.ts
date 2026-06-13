import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  LoanAgreementSummaryDto,
  SendLoanAgreementResultDto,
  SignLoanAgreementResultDto,
} from '@lms/types';
import {
  DisbursementStatus,
  InterestType,
  LoanAgreementStatus,
  LoanStatus,
} from '@lms/types';
import { appendLoanAgreementSignature, buildLoanAgreementHtml } from '@lms/utils';
import { LoanAgreementStatus as PrismaLoanAgreementStatus } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { formatCents } from '../common/money';
import { getNcrRepoRatePercent } from '../config/env';
import { NotificationDispatchService } from '../notifications/notification-dispatch.service';
import { PrismaService, type PrismaTx } from '../prisma/prisma.service';

const INTEREST_LABELS: Record<string, string> = {
  [InterestType.FLAT]: 'Flat rate',
  [InterestType.REDUCING]: 'Reducing balance',
};

const FREQUENCY_LABELS: Record<string, string> = {
  MONTHLY: 'monthly',
  WEEKLY: 'weekly',
  FORTNIGHTLY: 'fortnightly',
};

@Injectable()
export class LoanAgreementService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly notificationDispatch: NotificationDispatchService,
  ) {}

  buildSummaryForLender(
    loan: {
      status: string;
      disbursementStatus: string;
      loanAgreement?: {
        status: PrismaLoanAgreementStatus;
        generatedAt: Date;
        signedAt: Date | null;
        signedBy?: { name: string } | null;
      } | null;
    },
  ): LoanAgreementSummaryDto {
    const agreement = loan.loanAgreement;
    if (!agreement) {
      const canSend =
        (loan.status === LoanStatus.DRAFT || loan.status === LoanStatus.ACTIVE) &&
        loan.disbursementStatus !== DisbursementStatus.COMPLETED;
      return {
        status: LoanAgreementStatus.NOT_SENT,
        sentAt: null,
        signedAt: null,
        signerName: null,
        canSend,
        canDisburse: false,
        requiresBorrowerSignature: false,
        canSign: false,
      };
    }

    const signed = agreement.status === PrismaLoanAgreementStatus.SIGNED;
    const pending = agreement.status === PrismaLoanAgreementStatus.PENDING_SIGNATURE;
    const canDisburse =
      signed &&
      (loan.status === LoanStatus.ACTIVE || loan.status === LoanStatus.IN_ARREARS) &&
      loan.disbursementStatus !== DisbursementStatus.COMPLETED &&
      loan.disbursementStatus !== DisbursementStatus.PENDING;

    return {
      status: signed
        ? LoanAgreementStatus.SIGNED
        : LoanAgreementStatus.PENDING_SIGNATURE,
      sentAt: agreement.generatedAt.toISOString(),
      signedAt: agreement.signedAt?.toISOString() ?? null,
      signerName: agreement.signedBy?.name ?? null,
      canSend: !signed && loan.disbursementStatus !== DisbursementStatus.COMPLETED,
      canDisburse,
      requiresBorrowerSignature: false,
      canSign: false,
    };
  }

  buildSummaryForBorrower(
    loan: {
      disbursementStatus: string;
      loanAgreement?: {
        status: PrismaLoanAgreementStatus;
        generatedAt: Date;
        signedAt: Date | null;
        signedBy?: { name: string } | null;
      } | null;
    },
  ): LoanAgreementSummaryDto {
    const agreement = loan.loanAgreement;
    if (!agreement) {
      return {
        status: LoanAgreementStatus.NOT_SENT,
        sentAt: null,
        signedAt: null,
        signerName: null,
        canSend: false,
        canDisburse: false,
        requiresBorrowerSignature: false,
        canSign: false,
      };
    }

    const signed = agreement.status === PrismaLoanAgreementStatus.SIGNED;
    const pending = agreement.status === PrismaLoanAgreementStatus.PENDING_SIGNATURE;

    return {
      status: signed
        ? LoanAgreementStatus.SIGNED
        : LoanAgreementStatus.PENDING_SIGNATURE,
      sentAt: agreement.generatedAt.toISOString(),
      signedAt: agreement.signedAt?.toISOString() ?? null,
      signerName: agreement.signedBy?.name ?? null,
      canSend: false,
      canDisburse: false,
      requiresBorrowerSignature:
        pending && loan.disbursementStatus !== DisbursementStatus.COMPLETED,
      canSign:
        pending && loan.disbursementStatus !== DisbursementStatus.COMPLETED,
    };
  }

  async assertDisbursementAllowed(tx: PrismaTx, loanId: string): Promise<void> {
    const agreement = await tx.loanAgreement.findUnique({ where: { loanId } });
    if (!agreement || agreement.status !== PrismaLoanAgreementStatus.SIGNED) {
      throw new BadRequestException(
        'The borrower must sign the loan agreement before you can disburse funds',
      );
    }
  }

  async sendToBorrower(
    orgId: string,
    userId: string,
    loanId: string,
  ): Promise<SendLoanAgreementResultDto> {
    const result = await this.prisma.withOrgContext(orgId, userId, async (tx) => {
      const loan = await tx.loan.findFirst({
        where: { id: loanId, orgId, deletedAt: null },
        include: {
          borrower: true,
          organisation: true,
          loanApplication: { select: { borrowerUserId: true } },
          loanAgreement: true,
        },
      });

      if (!loan) {
        throw new NotFoundException('Loan not found');
      }

      if (loan.status !== LoanStatus.DRAFT && loan.status !== LoanStatus.ACTIVE) {
        throw new BadRequestException(
          'Loan agreements can only be sent for draft or active loans',
        );
      }

      if (loan.disbursementStatus === DisbursementStatus.COMPLETED) {
        throw new BadRequestException('Loan has already been disbursed');
      }

      if (loan.loanAgreement?.status === PrismaLoanAgreementStatus.SIGNED) {
        throw new BadRequestException('The borrower has already signed this agreement');
      }

      const borrowerUserId =
        loan.borrower.platformUserId ?? loan.loanApplication?.borrowerUserId;

      if (!borrowerUserId) {
        throw new BadRequestException(
          'Borrower is not linked to a platform account; cannot send agreement',
        );
      }

      const html = buildLoanAgreementHtml({
        organisationName: loan.organisation.name,
        borrowerName: loan.borrower.fullName,
        principalFormatted: formatCents(loan.principalCents),
        annualRatePercent: Number(loan.interestRate),
        interestTypeLabel: INTEREST_LABELS[loan.interestType] ?? loan.interestType,
        termPeriods: loan.termPeriods,
        frequencyLabel:
          FREQUENCY_LABELS[loan.frequency] ?? loan.frequency.toLowerCase(),
        startDate: loan.startDate.toISOString().slice(0, 10),
        generatedAt: new Date().toISOString().slice(0, 10),
        repoRatePercent: getNcrRepoRatePercent(),
      });

      const agreement = await tx.loanAgreement.upsert({
        where: { loanId: loan.id },
        create: {
          loanId: loan.id,
          orgId,
          status: PrismaLoanAgreementStatus.PENDING_SIGNATURE,
          annualRatePercent: loan.interestRate,
          generatedHtml: html,
          generatedByUserId: userId,
        },
        update: {
          status: PrismaLoanAgreementStatus.PENDING_SIGNATURE,
          annualRatePercent: loan.interestRate,
          generatedHtml: html,
          generatedByUserId: userId,
          generatedAt: new Date(),
          signedHtml: null,
          signature: undefined,
          signedByUserId: null,
          signedAt: null,
        },
        include: { signedBy: { select: { name: true } } },
      });

      await this.auditService.record(tx, {
        orgId,
        userId,
        action: 'loan.agreement.sent',
        entityType: 'LOAN',
        entityId: loanId,
        after: {
          agreementId: agreement.id,
          borrowerUserId,
          status: PrismaLoanAgreementStatus.PENDING_SIGNATURE,
        },
      });

      return {
        loan,
        agreement,
        borrowerUserId,
      };
    });

    void this.notificationDispatch.notifyLoanAgreementSent({
      orgId,
      loanId,
      borrowerUserId: result.borrowerUserId,
      organisationName: result.loan.organisation.name,
      principalCents: result.loan.principalCents,
    });

    return {
      loanId,
      agreement: this.buildSummaryForLender({
        status: result.loan.status,
        disbursementStatus: result.loan.disbursementStatus,
        loanAgreement: result.agreement,
      }),
    };
  }

  async getHtmlForLender(
    orgId: string,
    userId: string,
    loanId: string,
  ): Promise<string> {
    return this.prisma.withOrgContext(orgId, userId, async (tx) => {
      const agreement = await tx.loanAgreement.findFirst({
        where: { loanId, orgId },
      });

      if (!agreement) {
        throw new NotFoundException('No loan agreement has been sent yet');
      }

      return agreement.signedHtml ?? agreement.generatedHtml;
    });
  }

  async getHtmlForBorrower(userId: string, loanId: string): Promise<string> {
    return this.prisma.withUserContext(userId, null, async (tx) => {
      const loan = await this.findAccessibleLoan(tx, userId, loanId);
      const agreement = await tx.loanAgreement.findUnique({ where: { loanId: loan.id } });

      if (!agreement) {
        throw new NotFoundException('No loan agreement is available for this loan');
      }

      return agreement.signedHtml ?? agreement.generatedHtml;
    });
  }

  async signForBorrower(
    userId: string,
    loanId: string,
  ): Promise<SignLoanAgreementResultDto> {
    const result = await this.prisma.withUserContext(userId, null, async (tx) => {
      const loan = await this.findAccessibleLoan(tx, userId, loanId, {
        includeOrg: true,
      });

      const agreement = await tx.loanAgreement.findUnique({
        where: { loanId: loan.id },
      });

      if (!agreement) {
        throw new BadRequestException('No loan agreement is waiting for your signature');
      }

      if (agreement.status === PrismaLoanAgreementStatus.SIGNED) {
        throw new BadRequestException('You have already signed this agreement');
      }

      if (loan.disbursementStatus === DisbursementStatus.COMPLETED) {
        throw new BadRequestException('This loan has already been disbursed');
      }

      const user = await tx.user.findUnique({
        where: { id: userId },
        include: { borrowerAccount: true },
      });

      if (!user) {
        throw new NotFoundException('User not found');
      }

      const idNumber = user.idNumber ?? user.borrowerAccount?.idNumber;
      if (!idNumber) {
        throw new BadRequestException(
          'Complete your profile with a valid SA ID number before signing',
        );
      }

      const signedAtIso = new Date().toISOString();
      const orgName = loan.organisation?.name ?? 'Lender';
      const signaturePayload = {
        signerUserId: userId,
        signerName: user.name,
        signerEmail: user.email,
        idNumber,
        organisationName: orgName,
        signedAt: signedAtIso,
        acknowledgment: `I, ${user.name}, acknowledge and accept the terms of this loan agreement with ${orgName}.`,
      };

      const signedHtml = appendLoanAgreementSignature(agreement.generatedHtml, {
        signerName: user.name,
        signerEmail: user.email,
        idNumber,
        organisationName: orgName,
        signedAt: signedAtIso,
      });

      const updated = await tx.loanAgreement.update({
        where: { id: agreement.id },
        data: {
          status: PrismaLoanAgreementStatus.SIGNED,
          signedHtml,
          signature: signaturePayload,
          signedByUserId: userId,
          signedAt: new Date(),
        },
        include: { signedBy: { select: { name: true } } },
      });

      await this.auditService.record(tx, {
        orgId: loan.orgId,
        userId,
        action: 'loan.agreement.signed',
        entityType: 'LOAN',
        entityId: loanId,
        after: {
          agreementId: updated.id,
          signedAt: signedAtIso,
        },
      });

      return { loan, agreement: updated };
    });

    void this.notificationDispatch.notifyLoanAgreementSigned({
      orgId: result.loan.orgId,
      loanId,
      borrowerUserId: userId,
      borrowerName: result.loan.borrower.fullName,
      organisationName: result.loan.organisation?.name ?? 'Lender',
      principalCents: result.loan.principalCents,
    });

    return {
      loanId,
      agreement: this.buildSummaryForBorrower({
        disbursementStatus: result.loan.disbursementStatus,
        loanAgreement: result.agreement,
      }),
    };
  }

  private async findAccessibleLoan(
    tx: PrismaTx,
    userId: string,
    loanId: string,
    options?: { includeOrg?: boolean },
  ) {
    const links = await tx.borrowerLenderLink.findMany({
      where: { borrowerUserId: userId },
      select: { orgId: true },
    });

    const orgIds = links.map((link) => link.orgId);
    if (orgIds.length === 0) {
      throw new NotFoundException('Loan not found');
    }

    const borrowers = await tx.borrower.findMany({
      where: {
        platformUserId: userId,
        orgId: { in: orgIds },
        deletedAt: null,
      },
      select: { id: true },
    });

    const borrowerIds = borrowers.map((borrower) => borrower.id);
    if (borrowerIds.length === 0) {
      throw new NotFoundException('Loan not found');
    }

    const loan = await tx.loan.findFirst({
      where: {
        id: loanId,
        orgId: { in: orgIds },
        borrowerId: { in: borrowerIds },
        deletedAt: null,
      },
      include: {
        borrower: true,
        ...(options?.includeOrg ? { organisation: true } : {}),
      },
    });

    if (!loan) {
      throw new NotFoundException('Loan not found');
    }

    return loan;
  }
}
