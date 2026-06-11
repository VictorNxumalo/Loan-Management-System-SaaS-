import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  ApproveLoanApplicationInput,
  ApproveLoanApplicationResultDto,
  ListLoanApplicationsQuery,
  LoanApplicationDetailDto,
  LoanApplicationListItemDto,
  PaginatedLoanApplicationsDto,
  RejectLoanApplicationInput,
  SubmitLoanApplicationInput,
} from '@lms/types';
import { LoanApplicationStatus, LoanStatus } from '@lms/types';
import { formatCents } from '../common/money';
import { PrismaService, PrismaTx } from '../prisma/prisma.service';
import { LoansScheduleService } from '../loans/loans-schedule.service';
import { NotificationDispatchService } from '../notifications/notification-dispatch.service';

type ApplicationDbRow = {
  id: string;
  orgId: string;
  borrowerUserId: string;
  borrowerId: string | null;
  loanId: string | null;
  principalCents: number;
  interestType: string;
  termPeriods: number;
  frequency: string;
  startDate: Date;
  purpose: string | null;
  status: string;
  lenderNotes: string | null;
  reviewedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  organisation: { name: string };
  borrowerUser?: { name: string } | null;
};

type ApplicationRow = ApplicationDbRow & { borrowerName: string };

@Injectable()
export class LoanApplicationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scheduleService: LoansScheduleService,
    private readonly notificationDispatch: NotificationDispatchService,
  ) {}

  async submit(
    borrowerUserId: string,
    input: SubmitLoanApplicationInput,
  ): Promise<LoanApplicationDetailDto> {
    return this.prisma.withUserContext(borrowerUserId, null, async (tx) => {
      const link = await tx.borrowerLenderLink.findUnique({
        where: {
          borrowerUserId_orgId: {
            borrowerUserId,
            orgId: input.orgId,
          },
        },
      });

      if (!link) {
        throw new BadRequestException(
          'Connect with this lender before submitting an application',
        );
      }

      const pending = await tx.loanApplication.findFirst({
        where: {
          orgId: input.orgId,
          borrowerUserId,
          status: LoanApplicationStatus.SUBMITTED,
        },
      });

      if (pending) {
        throw new BadRequestException(
          'You already have a pending application with this lender',
        );
      }

      const created = await tx.loanApplication.create({
        data: {
          orgId: input.orgId,
          borrowerUserId,
          principalCents: input.principalCents,
          interestType: input.interestType,
          termPeriods: input.termPeriods,
          frequency: input.frequency,
          startDate: input.startDate,
          purpose: input.purpose?.trim() || null,
          status: LoanApplicationStatus.SUBMITTED,
        },
        include: {
          organisation: true,
          borrowerUser: true,
        },
      });

      const detail = this.mapDetail(this.toApplicationRow(created));

      void this.notificationDispatch.notifyApplicationSubmitted({
        orgId: input.orgId,
        applicationId: created.id,
        borrowerName: detail.borrowerName,
        principalCents: input.principalCents,
      });

      return detail;
    });
  }

  async listForBorrower(
    borrowerUserId: string,
    query: ListLoanApplicationsQuery,
  ): Promise<PaginatedLoanApplicationsDto> {
    const skip = (query.page - 1) * query.limit;

    return this.prisma.withUserContext(borrowerUserId, null, async (tx) => {
      const where = {
        borrowerUserId,
        ...(query.status ? { status: query.status } : {}),
      };

      const [total, rows] = await Promise.all([
        tx.loanApplication.count({ where }),
        tx.loanApplication.findMany({
          where,
          include: { organisation: true, borrowerUser: true },
          orderBy: { createdAt: 'desc' },
          skip,
          take: query.limit,
        }),
      ]);

      return this.paginate(rows.map((row) => this.toApplicationRow(row)), query, total);
    });
  }

  async getForBorrower(
    borrowerUserId: string,
    id: string,
  ): Promise<LoanApplicationDetailDto> {
    return this.prisma.withUserContext(borrowerUserId, null, async (tx) => {
      const row = await tx.loanApplication.findFirst({
        where: { id, borrowerUserId },
        include: { organisation: true, borrowerUser: true },
      });

      if (!row) {
        throw new NotFoundException('Application not found');
      }

      return this.mapDetail(this.toApplicationRow(row));
    });
  }

  async withdraw(borrowerUserId: string, id: string): Promise<LoanApplicationDetailDto> {
    return this.prisma.withUserContext(borrowerUserId, null, async (tx) => {
      const row = await tx.loanApplication.findFirst({
        where: { id, borrowerUserId, status: LoanApplicationStatus.SUBMITTED },
        include: { organisation: true, borrowerUser: true },
      });

      if (!row) {
        throw new NotFoundException('Pending application not found');
      }

      const updated = await tx.loanApplication.update({
        where: { id },
        data: { status: LoanApplicationStatus.WITHDRAWN },
        include: { organisation: true, borrowerUser: true },
      });

      return this.mapDetail(this.toApplicationRow(updated));
    });
  }

  async listForLender(
    orgId: string,
    userId: string,
    query: ListLoanApplicationsQuery,
  ): Promise<PaginatedLoanApplicationsDto> {
    const skip = (query.page - 1) * query.limit;

    return this.prisma.withOrgContext(orgId, userId, async (tx) => {
      const where = {
        orgId,
        ...(query.status ? { status: query.status } : {}),
      };

      const [total, rows] = await Promise.all([
        tx.loanApplication.count({ where }),
        tx.loanApplication.findMany({
          where,
          include: { organisation: true },
          orderBy: { createdAt: 'desc' },
          skip,
          take: query.limit,
        }),
      ]);

      const borrowerNames = await this.resolveBorrowerNames(
        rows.map((row) => row.borrowerUserId),
      );

      return this.paginate(
        rows.map((row) => this.toApplicationRow(row, borrowerNames)),
        query,
        total,
      );
    });
  }

  async getForLender(
    orgId: string,
    userId: string,
    id: string,
  ): Promise<LoanApplicationDetailDto> {
    return this.prisma.withOrgContext(orgId, userId, async (tx) => {
      const row = await tx.loanApplication.findFirst({
        where: { id, orgId },
        include: { organisation: true },
      });

      if (!row) {
        throw new NotFoundException('Application not found');
      }

      const borrowerNames = await this.resolveBorrowerNames([row.borrowerUserId]);
      return this.mapDetail(this.toApplicationRow(row, borrowerNames));
    });
  }

  async reject(
    orgId: string,
    userId: string,
    id: string,
    input: RejectLoanApplicationInput,
  ): Promise<LoanApplicationDetailDto> {
    return this.prisma.withOrgContext(orgId, userId, async (tx) => {
      const row = await tx.loanApplication.findFirst({
        where: { id, orgId, status: LoanApplicationStatus.SUBMITTED },
        include: { organisation: true },
      });

      if (!row) {
        throw new NotFoundException('Pending application not found');
      }

      const updated = await tx.loanApplication.update({
        where: { id },
        data: {
          status: LoanApplicationStatus.REJECTED,
          lenderNotes: input.lenderNotes.trim(),
          reviewedByUserId: userId,
          reviewedAt: new Date(),
        },
        include: { organisation: true },
      });

      const borrowerNames = await this.resolveBorrowerNames([updated.borrowerUserId]);
      const detail = this.mapDetail(this.toApplicationRow(updated, borrowerNames));

      void this.notificationDispatch.notifyApplicationRejected({
        orgId,
        applicationId: id,
        borrowerUserId: updated.borrowerUserId,
        organisationName: updated.organisation.name,
        principalCents: updated.principalCents,
        lenderNotes: input.lenderNotes.trim(),
      });

      return detail;
    });
  }

  async approve(
    orgId: string,
    userId: string,
    id: string,
    input: ApproveLoanApplicationInput,
  ): Promise<ApproveLoanApplicationResultDto> {
    const platformUser = await this.loadBorrowerPlatformUser(id, orgId, userId);

    return this.prisma.withOrgContext(orgId, userId, async (tx) => {
      const application = await tx.loanApplication.findFirst({
        where: { id, orgId, status: LoanApplicationStatus.SUBMITTED },
        include: { organisation: true },
      });

      if (!application) {
        throw new NotFoundException('Pending application not found');
      }

      const borrowerRecord = await this.ensureBorrowerRecord(
        tx,
        orgId,
        application.borrowerUserId,
        platformUser,
      );

      const loan = await tx.loan.create({
        data: {
          orgId,
          borrowerId: borrowerRecord.id,
          createdByUserId: userId,
          principalCents: application.principalCents,
          interestRate: input.annualRate,
          interestType: application.interestType,
          termPeriods: application.termPeriods,
          frequency: application.frequency,
          startDate: application.startDate,
          status: LoanStatus.DRAFT,
        },
      });

      await this.scheduleService.persistScheduleForLoan(
        loan.id,
        orgId,
        userId,
        {
          principalCents: application.principalCents,
          annualRate: input.annualRate,
          interestType: application.interestType,
          termPeriods: application.termPeriods,
          frequency: application.frequency,
          startDate: application.startDate,
        },
        tx,
      );

      const updated = await tx.loanApplication.update({
        where: { id: application.id },
        data: {
          status: LoanApplicationStatus.APPROVED,
          borrowerId: borrowerRecord.id,
          loanId: loan.id,
          lenderNotes: input.lenderNotes?.trim() || null,
          reviewedByUserId: userId,
          reviewedAt: new Date(),
        },
        include: { organisation: true },
      });

      const borrowerNames = await this.resolveBorrowerNames([updated.borrowerUserId]);
      const detail = this.mapDetail(this.toApplicationRow(updated, borrowerNames));

      void this.notificationDispatch.notifyApplicationApproved({
        orgId,
        applicationId: application.id,
        borrowerUserId: application.borrowerUserId,
        organisationName: application.organisation.name,
        principalCents: application.principalCents,
      });

      return {
        application: detail,
        loanId: loan.id,
        borrowerId: borrowerRecord.id,
      };
    });
  }

  private async loadBorrowerPlatformUser(
    applicationId: string,
    orgId: string,
    userId: string,
  ) {
    const application = await this.prisma.withOrgContext(orgId, userId, async (tx) =>
      tx.loanApplication.findFirst({
        where: { id: applicationId, orgId, status: LoanApplicationStatus.SUBMITTED },
        select: { borrowerUserId: true },
      }),
    );

    if (!application) {
      throw new NotFoundException('Pending application not found');
    }

    return this.prisma.withAuthLookup(async (tx) =>
      tx.user.findUnique({
        where: { id: application.borrowerUserId },
        include: { borrowerAccount: true },
      }),
    );
  }

  private async resolveBorrowerNames(userIds: string[]): Promise<Map<string, string>> {
    const uniqueIds = [...new Set(userIds)];
    if (uniqueIds.length === 0) {
      return new Map();
    }

    const users = await this.prisma.withAuthLookup(async (tx) =>
      tx.user.findMany({
        where: { id: { in: uniqueIds } },
        select: { id: true, name: true },
      }),
    );

    return new Map(users.map((user) => [user.id, user.name]));
  }

  private toApplicationRow(
    row: ApplicationDbRow,
    borrowerNames?: Map<string, string>,
  ): ApplicationRow {
    return {
      ...row,
      borrowerName:
        row.borrowerUser?.name ?? borrowerNames?.get(row.borrowerUserId) ?? 'Borrower',
    };
  }

  private async ensureBorrowerRecord(
    tx: PrismaTx,
    orgId: string,
    borrowerUserId: string,
    platformUser: Awaited<ReturnType<LoanApplicationsService['loadBorrowerPlatformUser']>>,
  ) {
    const existing = await tx.borrower.findFirst({
      where: { orgId, platformUserId: borrowerUserId, deletedAt: null },
    });

    if (existing) {
      return existing;
    }

    if (!platformUser?.borrowerAccount) {
      throw new BadRequestException('Borrower profile is incomplete');
    }

    const idNumber =
      platformUser.borrowerAccount.idNumber?.trim() ||
      `PLATFORM-${borrowerUserId.replace(/-/g, '').slice(0, 12).toUpperCase()}`;

    return tx.borrower.create({
      data: {
        orgId,
        platformUserId: borrowerUserId,
        fullName: platformUser.name,
        idNumber,
        phone: platformUser.borrowerAccount.phone,
        email: platformUser.email,
      },
    });
  }

  private paginate(
    rows: ApplicationRow[],
    query: ListLoanApplicationsQuery,
    total: number,
  ): PaginatedLoanApplicationsDto {
    return {
      items: rows.map((row) => this.mapListItem(row)),
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / query.limit)),
    };
  }

  private mapListItem(row: ApplicationRow): LoanApplicationListItemDto {
    return {
      id: row.id,
      orgId: row.orgId,
      organisationName: row.organisation.name,
      borrowerUserId: row.borrowerUserId,
      borrowerName: row.borrowerName,
      principalFormatted: formatCents(row.principalCents),
      status: row.status,
      purpose: row.purpose,
      startDate: row.startDate.toISOString().slice(0, 10),
      termPeriods: row.termPeriods,
      frequency: row.frequency,
      interestType: row.interestType,
      loanId: row.loanId,
      submittedAt: row.createdAt.toISOString(),
      reviewedAt: row.reviewedAt?.toISOString() ?? null,
    };
  }

  private mapDetail(row: ApplicationRow): LoanApplicationDetailDto {
    return {
      ...this.mapListItem(row),
      lenderNotes: row.lenderNotes,
      borrowerId: row.borrowerId,
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
