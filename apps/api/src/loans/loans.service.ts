import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import type {
  CreateLoanInput,
  CreateRepaymentInput,
  GenerateScheduleInputDto,
  ListLoansQuery,
  LoanDetailDto,
  LoanListItemDto,
  PaginatedLoansDto,
  PreviewScheduleInputDto,
  RecordRepaymentResultDto,
  RepaymentDto,
  SchedulePreviewResultDto,
  UpdateLoanInput,
} from '@lms/types';
import { LoanStatus } from '@lms/types';
import { previewRepaymentSchedule } from '@lms/utils';
import { formatCents } from '../common/money';
import { PrismaService } from '../prisma/prisma.service';
import { LoanBalanceService } from './loan-balance.service';
import { LoansScheduleService } from './loans-schedule.service';

@Injectable()
export class LoansService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scheduleService: LoansScheduleService,
    private readonly loanBalanceService: LoanBalanceService,
  ) {}

  previewSchedule(input: PreviewScheduleInputDto): SchedulePreviewResultDto {
    const { currencyCode, locale, ...scheduleInput } = input;
    return previewRepaymentSchedule(
      this.scheduleService.buildScheduleInput(scheduleInput),
      { currencyCode, locale },
    );
  }

  async list(
    orgId: string,
    userId: string,
    query: ListLoansQuery,
  ): Promise<PaginatedLoansDto> {
    const skip = (query.page - 1) * query.limit;

    return this.prisma.withOrgContext(orgId, userId, async (tx) => {
      const where = {
        orgId,
        deletedAt: null,
        ...(query.status ? { status: query.status } : {}),
        ...(query.borrowerId ? { borrowerId: query.borrowerId } : {}),
      };

      const [total, rows] = await Promise.all([
        tx.loan.count({ where }),
        tx.loan.findMany({
          where,
          include: {
            borrower: true,
            repaymentSchedules: true,
            repayments: true,
          },
          orderBy: { createdAt: 'desc' },
          skip,
          take: query.limit,
        }),
      ]);

      return {
        items: rows.map((row) => this.mapListItem(row)),
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / query.limit)),
      };
    });
  }

  async create(
    orgId: string,
    userId: string,
    input: CreateLoanInput,
  ): Promise<LoanDetailDto> {
    return this.prisma.withOrgContext(orgId, userId, async (tx) => {
      const borrower = await tx.borrower.findFirst({
        where: { id: input.borrowerId, orgId, deletedAt: null },
      });

      if (!borrower) {
        throw new NotFoundException('Borrower not found');
      }

      const loan = await tx.loan.create({
        data: {
          orgId,
          borrowerId: input.borrowerId,
          createdByUserId: userId,
          principalCents: input.principalCents,
          interestRate: input.annualRate,
          interestType: input.interestType,
          termPeriods: input.termPeriods,
          frequency: input.frequency,
          startDate: input.startDate,
          status: LoanStatus.DRAFT,
        },
      });

      await this.scheduleService.persistScheduleForLoan(
        loan.id,
        orgId,
        userId,
        input,
        tx,
      );

      const created = await tx.loan.findFirstOrThrow({
        where: { id: loan.id, orgId },
        include: {
          borrower: true,
          repaymentSchedules: { orderBy: { periodNumber: 'asc' } },
          repayments: true,
        },
      });

      return this.mapDetail(created);
    });
  }

  async getById(orgId: string, userId: string, id: string): Promise<LoanDetailDto> {
    return this.prisma.withOrgContext(orgId, userId, async (tx) => {
      const loan = await tx.loan.findFirst({
        where: { id, orgId, deletedAt: null },
        include: {
          borrower: true,
          repaymentSchedules: { orderBy: { periodNumber: 'asc' } },
          repayments: true,
        },
      });

      if (!loan) {
        throw new NotFoundException('Loan not found');
      }

      if (loan.status !== LoanStatus.DRAFT && loan.status !== LoanStatus.WRITTEN_OFF) {
        await this.loanBalanceService.syncLoanStatus(tx, orgId, loan.id, loan.status);
        const refreshed = await tx.loan.findFirstOrThrow({
          where: { id, orgId },
          include: {
            borrower: true,
            repaymentSchedules: { orderBy: { periodNumber: 'asc' } },
            repayments: true,
          },
        });
        return this.mapDetail(refreshed);
      }

      return this.mapDetail(loan);
    });
  }

  async update(
    orgId: string,
    userId: string,
    id: string,
    input: UpdateLoanInput,
  ): Promise<LoanDetailDto> {
    return this.prisma.withOrgContext(orgId, userId, async (tx) => {
      const loan = await tx.loan.findFirst({
        where: { id, orgId, deletedAt: null },
      });

      if (!loan) {
        throw new NotFoundException('Loan not found');
      }

      if (loan.status !== LoanStatus.DRAFT) {
        throw new BadRequestException('Only draft loans can be updated');
      }

      if (input.borrowerId) {
        const borrower = await tx.borrower.findFirst({
          where: { id: input.borrowerId, orgId, deletedAt: null },
        });
        if (!borrower) {
          throw new NotFoundException('Borrower not found');
        }
      }

      await tx.loan.update({
        where: { id },
        data: {
          ...(input.borrowerId !== undefined ? { borrowerId: input.borrowerId } : {}),
          ...(input.principalCents !== undefined
            ? { principalCents: input.principalCents }
            : {}),
          ...(input.annualRate !== undefined ? { interestRate: input.annualRate } : {}),
          ...(input.interestType !== undefined ? { interestType: input.interestType } : {}),
          ...(input.termPeriods !== undefined ? { termPeriods: input.termPeriods } : {}),
          ...(input.frequency !== undefined ? { frequency: input.frequency } : {}),
          ...(input.startDate !== undefined ? { startDate: input.startDate } : {}),
        },
      });

      const scheduleFields: (keyof GenerateScheduleInputDto)[] = [
        'principalCents',
        'annualRate',
        'interestType',
        'termPeriods',
        'frequency',
        'startDate',
      ];

      if (scheduleFields.some((field) => input[field] !== undefined)) {
        const current = await tx.loan.findFirstOrThrow({ where: { id, orgId } });
        await this.scheduleService.persistScheduleForLoan(
          loan.id,
          orgId,
          userId,
          {
            principalCents: input.principalCents ?? current.principalCents,
            annualRate: input.annualRate ?? Number(current.interestRate),
            interestType: input.interestType ?? current.interestType,
            termPeriods: input.termPeriods ?? current.termPeriods,
            frequency: input.frequency ?? current.frequency,
            startDate: input.startDate ?? current.startDate,
          },
          tx,
        );
      }

      const updated = await tx.loan.findFirstOrThrow({
        where: { id, orgId },
        include: {
          borrower: true,
          repaymentSchedules: { orderBy: { periodNumber: 'asc' } },
          repayments: true,
        },
      });

      return this.mapDetail(updated);
    });
  }

  async activate(orgId: string, userId: string, id: string): Promise<LoanDetailDto> {
    await this.prisma.withOrgContext(orgId, userId, async (tx) => {
      const loan = await tx.loan.findFirst({
        where: { id, orgId, deletedAt: null },
      });

      if (!loan) {
        throw new NotFoundException('Loan not found');
      }

      if (loan.status !== LoanStatus.DRAFT) {
        throw new BadRequestException('Only draft loans can be activated');
      }

      await tx.loan.update({
        where: { id },
        data: { status: LoanStatus.ACTIVE },
      });
    });

    return this.getById(orgId, userId, id);
  }

  async listRepayments(
    orgId: string,
    userId: string,
    loanId: string,
  ): Promise<RepaymentDto[]> {
    return this.prisma.withOrgContext(orgId, userId, async (tx) => {
      const loan = await tx.loan.findFirst({
        where: { id: loanId, orgId, deletedAt: null },
      });

      if (!loan) {
        throw new NotFoundException('Loan not found');
      }

      const repayments = await tx.repayment.findMany({
        where: { loanId, orgId },
        include: { recordedBy: true },
        orderBy: { paymentDate: 'desc' },
      });

      return repayments.map((row) => this.mapRepayment(row));
    });
  }

  async recordRepayment(
    orgId: string,
    userId: string,
    loanId: string,
    input: CreateRepaymentInput,
  ): Promise<RecordRepaymentResultDto> {
    return this.prisma.withOrgContext(orgId, userId, async (tx) => {
      const loan = await tx.loan.findFirst({
        where: { id: loanId, orgId, deletedAt: null },
        include: {
          repaymentSchedules: true,
          repayments: true,
        },
      });

      if (!loan) {
        throw new NotFoundException('Loan not found');
      }

      if (loan.status !== LoanStatus.ACTIVE && loan.status !== LoanStatus.IN_ARREARS) {
        throw new UnprocessableEntityException(
          'Repayments can only be recorded on active or in-arrears loans',
        );
      }

      const snapshot = this.loanBalanceService.computeFromData(
        loan.repaymentSchedules,
        loan.repayments,
        loan.status,
      );

      if (input.amountCents > snapshot.outstandingCents) {
        throw new BadRequestException(
          `Repayment amount exceeds outstanding balance (${formatCents(snapshot.outstandingCents)})`,
        );
      }

      const repayment = await tx.repayment.create({
        data: {
          loanId,
          orgId,
          amountCents: input.amountCents,
          paymentDate: input.paymentDate,
          recordedByUserId: userId,
          note: input.note?.trim() || null,
        },
        include: { recordedBy: true },
      });

      const updatedRepayments = [...loan.repayments, repayment];
      const newSnapshot = this.loanBalanceService.computeFromData(
        loan.repaymentSchedules,
        updatedRepayments,
        loan.status,
      );

      await tx.loan.update({
        where: { id: loanId },
        data: { status: newSnapshot.resolvedStatus },
      });

      return {
        repayment: this.mapRepayment(repayment),
        loan: {
          id: loanId,
          status: newSnapshot.resolvedStatus,
          totalPaidFormatted: formatCents(newSnapshot.totalPaidCents),
          outstandingBalanceFormatted: formatCents(newSnapshot.outstandingCents),
        },
      };
    });
  }

  private mapListItem(row: {
    id: string;
    borrowerId: string;
    status: string;
    startDate: Date;
    createdAt: Date;
    principalCents: number;
    borrower: { fullName: string };
    repaymentSchedules: { dueDate: Date; totalDueCents: number; periodNumber: number }[];
    repayments: { amountCents: number }[];
  }): LoanListItemDto {
    const snapshot = this.loanBalanceService.computeFromData(
      row.repaymentSchedules,
      row.repayments,
      row.status as typeof LoanStatus.DRAFT,
    );

    return {
      id: row.id,
      borrowerId: row.borrowerId,
      borrowerName: row.borrower.fullName,
      principalFormatted: formatCents(row.principalCents),
      status: row.status,
      startDate: row.startDate.toISOString().slice(0, 10),
      outstandingBalanceFormatted: formatCents(snapshot.outstandingCents),
      createdAt: row.createdAt.toISOString(),
    };
  }

  private mapDetail(row: {
    id: string;
    borrowerId: string;
    principalCents: number;
    interestRate: { toString(): string } | number;
    interestType: string;
    termPeriods: number;
    frequency: string;
    startDate: Date;
    status: string;
    createdAt: Date;
    updatedAt: Date;
    borrower: { fullName: string };
    repaymentSchedules: {
      periodNumber: number;
      dueDate: Date;
      principalDueCents: number;
      interestDueCents: number;
      totalDueCents: number;
      balanceAfterCents: number;
    }[];
    repayments: { amountCents: number }[];
  }): LoanDetailDto {
    const snapshot = this.loanBalanceService.computeFromData(
      row.repaymentSchedules,
      row.repayments,
      row.status as typeof LoanStatus.DRAFT,
    );

    return {
      id: row.id,
      borrowerId: row.borrowerId,
      borrowerName: row.borrower.fullName,
      principalCents: row.principalCents,
      principalFormatted: formatCents(row.principalCents),
      annualRate: Number(row.interestRate),
      interestType: row.interestType,
      termPeriods: row.termPeriods,
      frequency: row.frequency,
      startDate: row.startDate.toISOString().slice(0, 10),
      status: row.status,
      totalScheduledFormatted: formatCents(snapshot.totalScheduledCents),
      totalPaidFormatted: formatCents(snapshot.totalPaidCents),
      outstandingBalanceFormatted: formatCents(snapshot.outstandingCents),
      schedule: row.repaymentSchedules.map((period) => ({
        periodNumber: period.periodNumber,
        dueDate: period.dueDate.toISOString().slice(0, 10),
        principalDueFormatted: formatCents(period.principalDueCents),
        interestDueFormatted: formatCents(period.interestDueCents),
        totalDueFormatted: formatCents(period.totalDueCents),
        balanceAfterFormatted: formatCents(period.balanceAfterCents),
      })),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private mapRepayment(row: {
    id: string;
    amountCents: number;
    paymentDate: Date;
    note: string | null;
    createdAt: Date;
    recordedBy: { name: string };
  }): RepaymentDto {
    return {
      id: row.id,
      amountCents: row.amountCents,
      amountFormatted: formatCents(row.amountCents),
      paymentDate: row.paymentDate.toISOString().slice(0, 10),
      note: row.note,
      recordedByName: row.recordedBy.name,
      createdAt: row.createdAt.toISOString(),
    };
  }
}
