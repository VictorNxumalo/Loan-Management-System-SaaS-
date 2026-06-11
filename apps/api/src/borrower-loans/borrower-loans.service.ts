import { Injectable, NotFoundException } from '@nestjs/common';
import type {
  BorrowerLoanDetailDto,
  BorrowerLoanListItemDto,
  ListBorrowerLoansQuery,
  PaginatedBorrowerLoansDto,
} from '@lms/types';
import {
  BORROWER_LOAN_STATUS_LABELS,
  BORROWER_VISIBLE_LOAN_STATUSES,
  LoanStatus,
} from '@lms/types';
import { computeDaysOverdue } from '@lms/utils';
import { formatCents } from '../common/money';
import { PrismaService, type PrismaTx } from '../prisma/prisma.service';
import { LoanBalanceService } from '../loans/loan-balance.service';

interface AccessibleLoansFilter {
  orgIds: string[];
  borrowerIds: string[];
}

@Injectable()
export class BorrowerLoansService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly loanBalanceService: LoanBalanceService,
  ) {}

  async list(
    userId: string,
    query: ListBorrowerLoansQuery,
  ): Promise<PaginatedBorrowerLoansDto> {
    return this.prisma.withUserContext(userId, null, async (tx) => {
      const access = await this.resolveAccessibleLoansFilter(tx, userId);
      if (!access) {
        return this.emptyPage(query);
      }

      const skip = (query.page - 1) * query.limit;
      const where = {
        orgId: { in: access.orgIds },
        borrowerId: { in: access.borrowerIds },
        deletedAt: null,
        status: { in: [...BORROWER_VISIBLE_LOAN_STATUSES] },
      };

      const [total, rows, orgs] = await Promise.all([
        tx.loan.count({ where }),
        tx.loan.findMany({
          where,
          include: {
            repaymentSchedules: true,
            repayments: true,
          },
          orderBy: { createdAt: 'desc' },
          skip,
          take: query.limit,
        }),
        tx.organisation.findMany({
          where: { id: { in: access.orgIds }, deletedAt: null },
        }),
      ]);

      const orgNameById = new Map(orgs.map((org) => [org.id, org.name]));

      return {
        items: rows.map((row) =>
          this.mapListItem(row, orgNameById.get(row.orgId) ?? 'Unknown lender'),
        ),
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / query.limit)),
      };
    });
  }

  async getById(userId: string, loanId: string): Promise<BorrowerLoanDetailDto> {
    return this.prisma.withUserContext(userId, null, async (tx) => {
      const access = await this.resolveAccessibleLoansFilter(tx, userId);
      if (!access) {
        throw new NotFoundException('Loan not found');
      }

      const loan = await tx.loan.findFirst({
        where: {
          id: loanId,
          orgId: { in: access.orgIds },
          borrowerId: { in: access.borrowerIds },
          deletedAt: null,
          status: { in: [...BORROWER_VISIBLE_LOAN_STATUSES] },
        },
        include: {
          repaymentSchedules: { orderBy: { periodNumber: 'asc' } },
          repayments: { orderBy: { paymentDate: 'desc' } },
        },
      });

      if (!loan) {
        throw new NotFoundException('Loan not found');
      }

      if (loan.status !== LoanStatus.DRAFT && loan.status !== LoanStatus.WRITTEN_OFF) {
        await this.loanBalanceService.syncLoanStatus(
          tx,
          loan.orgId,
          loan.id,
          loan.status,
        );
      }

      const refreshed = await tx.loan.findFirstOrThrow({
        where: { id: loanId },
        include: {
          repaymentSchedules: { orderBy: { periodNumber: 'asc' } },
          repayments: { orderBy: { paymentDate: 'desc' } },
        },
      });

      const org = await tx.organisation.findFirst({
        where: { id: refreshed.orgId, deletedAt: null },
      });

      return this.mapDetail(refreshed, org?.name ?? 'Unknown lender');
    });
  }

  private async resolveAccessibleLoansFilter(
    tx: PrismaTx,
    userId: string,
  ): Promise<AccessibleLoansFilter | null> {
    const links = await tx.borrowerLenderLink.findMany({
      where: { borrowerUserId: userId },
    });

    const orgIds = links.map((link) => link.orgId);
    if (orgIds.length === 0) {
      return null;
    }

    const borrowers = await tx.borrower.findMany({
      where: {
        platformUserId: userId,
        orgId: { in: orgIds },
        deletedAt: null,
      },
    });

    const borrowerIds = borrowers.map((borrower) => borrower.id);
    if (borrowerIds.length === 0) {
      return null;
    }

    return { orgIds, borrowerIds };
  }

  private emptyPage(query: ListBorrowerLoansQuery): PaginatedBorrowerLoansDto {
    return {
      items: [],
      page: query.page,
      limit: query.limit,
      total: 0,
      totalPages: 1,
    };
  }

  private statusLabel(status: string): string {
    return BORROWER_LOAN_STATUS_LABELS[status] ?? status;
  }

  private mapListItem(
    row: {
      id: string;
      orgId: string;
      status: string;
      startDate: Date;
      createdAt: Date;
      principalCents: number;
      repaymentSchedules: { dueDate: Date; totalDueCents: number; periodNumber: number }[];
      repayments: { amountCents: number }[];
    },
    organisationName: string,
  ): BorrowerLoanListItemDto {
    const snapshot = this.loanBalanceService.computeFromData(
      row.repaymentSchedules,
      row.repayments,
      row.status as typeof LoanStatus.DRAFT,
    );

    return {
      id: row.id,
      orgId: row.orgId,
      organisationName,
      principalFormatted: formatCents(row.principalCents),
      status: row.status,
      statusLabel: this.statusLabel(row.status),
      startDate: row.startDate.toISOString().slice(0, 10),
      outstandingBalanceFormatted: formatCents(snapshot.outstandingCents),
      createdAt: row.createdAt.toISOString(),
    };
  }

  private mapDetail(
    row: {
      id: string;
      orgId: string;
      principalCents: number;
      interestRate: { toString(): string } | number;
      interestType: string;
      termPeriods: number;
      frequency: string;
      startDate: Date;
      status: string;
      createdAt: Date;
      updatedAt: Date;
      repaymentSchedules: {
        periodNumber: number;
        dueDate: Date;
        principalDueCents: number;
        interestDueCents: number;
        totalDueCents: number;
        balanceAfterCents: number;
      }[];
      repayments: {
        id: string;
        amountCents: number;
        paymentDate: Date;
        note: string | null;
        createdAt: Date;
      }[];
    },
    organisationName: string,
  ): BorrowerLoanDetailDto {
    const snapshot = this.loanBalanceService.computeFromData(
      row.repaymentSchedules,
      row.repayments,
      row.status as typeof LoanStatus.DRAFT,
    );

    const daysOverdue =
      row.status === LoanStatus.IN_ARREARS
        ? computeDaysOverdue(row.repaymentSchedules, snapshot.totalPaidCents)
        : null;

    return {
      id: row.id,
      orgId: row.orgId,
      organisationName,
      principalCents: row.principalCents,
      principalFormatted: formatCents(row.principalCents),
      annualRate: Number(row.interestRate),
      interestType: row.interestType,
      termPeriods: row.termPeriods,
      frequency: row.frequency,
      startDate: row.startDate.toISOString().slice(0, 10),
      status: row.status,
      statusLabel: this.statusLabel(row.status),
      totalScheduledFormatted: formatCents(snapshot.totalScheduledCents),
      totalPaidFormatted: formatCents(snapshot.totalPaidCents),
      outstandingBalanceFormatted: formatCents(snapshot.outstandingCents),
      daysOverdue,
      schedule: row.repaymentSchedules.map((period) => ({
        periodNumber: period.periodNumber,
        dueDate: period.dueDate.toISOString().slice(0, 10),
        principalDueFormatted: formatCents(period.principalDueCents),
        interestDueFormatted: formatCents(period.interestDueCents),
        totalDueFormatted: formatCents(period.totalDueCents),
        balanceAfterFormatted: formatCents(period.balanceAfterCents),
      })),
      repayments: row.repayments.map((repayment) => ({
        id: repayment.id,
        amountFormatted: formatCents(repayment.amountCents),
        paymentDate: repayment.paymentDate.toISOString().slice(0, 10),
        note: repayment.note,
        createdAt: repayment.createdAt.toISOString(),
      })),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
