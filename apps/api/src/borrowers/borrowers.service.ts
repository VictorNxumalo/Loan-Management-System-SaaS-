import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import type {
  BorrowerDetailDto,
  BorrowerListItemDto,
  BorrowerSearchResultDto,
  BorrowerSummaryDto,
  CreateBorrowerInput,
  ListBorrowersQuery,
  PaginatedBorrowersDto,
  PlatformBorrowerSearchResultDto,
  SearchBorrowersQuery,
  SearchPlatformBorrowersQuery,
  UpdateBorrowerInput,
} from '@lms/types';
import { LoanStatus } from '@lms/types';
import { AuditService } from '../audit/audit.service';
import { formatCents } from '../common/money';
import { LoanBalanceService } from '../loans/loan-balance.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class BorrowersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly loanBalanceService: LoanBalanceService,
    private readonly auditService: AuditService,
  ) {}

  async list(
    orgId: string,
    userId: string,
    query: ListBorrowersQuery,
  ): Promise<PaginatedBorrowersDto> {
    const skip = (query.page - 1) * query.limit;
    const q = query.q?.trim();

    return this.prisma.withOrgContext(orgId, userId, async (tx) => {
      const where = {
        orgId,
        deletedAt: null,
        ...(q
          ? {
              OR: [
                { fullName: { contains: q, mode: 'insensitive' as const } },
                { idNumber: { contains: q, mode: 'insensitive' as const } },
              ],
            }
          : {}),
      };

      const [total, rows] = await Promise.all([
        tx.borrower.count({ where }),
        tx.borrower.findMany({
          where,
          include: {
            loans: {
              where: { deletedAt: null },
              include: {
                repaymentSchedules: { orderBy: { periodNumber: 'asc' } },
                repayments: true,
              },
            },
          },
          orderBy: { fullName: 'asc' },
          skip,
          take: query.limit,
        }),
      ]);

      const items = rows.map((row) => ({
        ...this.mapListItem(row),
        summary: this.computeBorrowerSummary(row.loans),
      }));

      const allBorrowerLoans = await tx.loan.findMany({
        where: { orgId, deletedAt: null },
        include: {
          repaymentSchedules: { orderBy: { periodNumber: 'asc' } },
          repayments: true,
        },
      });
      const summary = this.computeBorrowerSummary(allBorrowerLoans);

      return {
        items,
        summary,
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / query.limit)),
      };
    });
  }

  async search(
    orgId: string,
    userId: string,
    query: SearchBorrowersQuery,
  ): Promise<BorrowerSearchResultDto[]> {
    const q = query.q.trim();

    return this.prisma.withOrgContext(orgId, userId, async (tx) => {
      const rows = await tx.borrower.findMany({
        where: {
          orgId,
          deletedAt: null,
          OR: [
            { fullName: { contains: q, mode: 'insensitive' } },
            { idNumber: { contains: q, mode: 'insensitive' } },
          ],
        },
        orderBy: { fullName: 'asc' },
        take: query.limit,
      });

      return rows.map((row) => ({
        id: row.id,
        fullName: row.fullName,
        idNumber: row.idNumber,
        label: `${row.fullName} (${row.idNumber})`,
      }));
    });
  }

  /**
   * Search registered platform borrowers connected to this organisation
   * (via invite or marketplace) by name, email, or ID number — used to
   * auto-fill the new borrower form.
   */
  async searchPlatformBorrowers(
    orgId: string,
    userId: string,
    query: SearchPlatformBorrowersQuery,
  ): Promise<PlatformBorrowerSearchResultDto[]> {
    const q = query.q.trim();

    return this.prisma.withOrgContext(orgId, userId, async (tx) => {
      const links = await tx.borrowerLenderLink.findMany({
        where: { orgId },
        select: { borrowerUserId: true },
      });

      const connectedIds = links.map((link) => link.borrowerUserId);
      if (connectedIds.length === 0) {
        return [];
      }

      const users = await tx.user.findMany({
        where: {
          id: { in: connectedIds },
          deletedAt: null,
          isActive: true,
          OR: [
            { name: { contains: q, mode: 'insensitive' } },
            { email: { contains: q, mode: 'insensitive' } },
            { borrowerAccount: { idNumber: { contains: q, mode: 'insensitive' } } },
          ],
        },
        include: { borrowerAccount: true },
        orderBy: { name: 'asc' },
        take: query.limit,
      });

      const existing = await tx.borrower.findMany({
        where: {
          orgId,
          platformUserId: { in: users.map((user) => user.id) },
          deletedAt: null,
        },
        select: { id: true, platformUserId: true },
      });
      const existingByUserId = new Map(
        existing.map((row) => [row.platformUserId, row.id]),
      );

      return users.map((user) => ({
        userId: user.id,
        name: user.name,
        email: user.email,
        phone: user.borrowerAccount?.phone ?? null,
        idNumber: user.borrowerAccount?.idNumber ?? null,
        existingBorrowerId: existingByUserId.get(user.id) ?? null,
      }));
    });
  }

  async create(
    orgId: string,
    userId: string,
    input: CreateBorrowerInput,
  ): Promise<BorrowerDetailDto> {
    const email = input.email?.trim() || null;

    try {
      return await this.prisma.withOrgContext(orgId, userId, async (tx) => {
        if (input.platformUserId) {
          const link = await tx.borrowerLenderLink.findUnique({
            where: {
              borrowerUserId_orgId: {
                borrowerUserId: input.platformUserId,
                orgId,
              },
            },
          });
          if (!link) {
            throw new BadRequestException(
              'This platform user is not connected to your organisation',
            );
          }

          const alreadyLinked = await tx.borrower.findFirst({
            where: { orgId, platformUserId: input.platformUserId, deletedAt: null },
          });
          if (alreadyLinked) {
            throw new ConflictException(
              'A borrower record already exists for this platform user',
            );
          }
        }

        const created = await tx.borrower.create({
          data: {
            orgId,
            platformUserId: input.platformUserId ?? null,
            fullName: input.fullName.trim(),
            idNumber: input.idNumber.trim(),
            phone: input.phone.trim(),
            email,
            address: input.address?.trim() || null,
            employer: input.employer?.trim() || null,
            monthlyIncomeCents: input.monthlyIncomeCents ?? null,
          },
        });

        await this.auditService.record(tx, {
          orgId,
          userId,
          action: 'borrower.created',
          entityType: 'BORROWER',
          entityId: created.id,
          after: {
            fullName: created.fullName,
            idNumber: created.idNumber,
            phone: created.phone,
            ...(created.platformUserId
              ? { platformUserId: created.platformUserId }
              : {}),
          },
        });

        return this.mapDetail(created, {
          totalLoans: 0,
          totalOutstandingFormatted: formatCents(0),
          loansInArrears: 0,
        });
      });
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof ConflictException
      ) {
        throw error;
      }
      throw new ConflictException('A borrower with this ID number already exists');
    }
  }

  async getById(
    orgId: string,
    userId: string,
    id: string,
  ): Promise<BorrowerDetailDto> {
    return this.prisma.withOrgContext(orgId, userId, async (tx) => {
      const borrower = await tx.borrower.findFirst({
        where: { id, orgId, deletedAt: null },
      });

      if (!borrower) {
        throw new NotFoundException('Borrower not found');
      }

      const summary = await this.buildSummary(tx, orgId, borrower.id);
      return this.mapDetail(borrower, summary);
    });
  }

  async update(
    orgId: string,
    userId: string,
    id: string,
    input: UpdateBorrowerInput,
  ): Promise<BorrowerDetailDto> {
    return this.prisma.withOrgContext(orgId, userId, async (tx) => {
      const existing = await tx.borrower.findFirst({
        where: { id, orgId, deletedAt: null },
      });

      if (!existing) {
        throw new NotFoundException('Borrower not found');
      }

      try {
        const updated = await tx.borrower.update({
          where: { id },
          data: {
            ...(input.fullName !== undefined
              ? { fullName: input.fullName.trim() }
              : {}),
            ...(input.idNumber !== undefined
              ? { idNumber: input.idNumber.trim() }
              : {}),
            ...(input.phone !== undefined ? { phone: input.phone.trim() } : {}),
            ...(input.email !== undefined
              ? { email: input.email?.trim() || null }
              : {}),
            ...(input.address !== undefined
              ? { address: input.address?.trim() || null }
              : {}),
            ...(input.employer !== undefined
              ? { employer: input.employer?.trim() || null }
              : {}),
            ...(input.monthlyIncomeCents !== undefined
              ? { monthlyIncomeCents: input.monthlyIncomeCents }
              : {}),
          },
        });

        await this.auditService.record(tx, {
          orgId,
          userId,
          action: 'borrower.updated',
          entityType: 'BORROWER',
          entityId: id,
          before: {
            fullName: existing.fullName,
            idNumber: existing.idNumber,
            phone: existing.phone,
            email: existing.email,
          },
          after: {
            fullName: updated.fullName,
            idNumber: updated.idNumber,
            phone: updated.phone,
            email: updated.email,
          },
        });

        const summary = await this.buildSummary(tx, orgId, id);
        return this.mapDetail(updated, summary);
      } catch (error) {
        if (error instanceof NotFoundException) throw error;
        throw new ConflictException('A borrower with this ID number already exists');
      }
    });
  }

  async softDelete(orgId: string, userId: string, id: string): Promise<{ message: string }> {
    return this.prisma.withOrgContext(orgId, userId, async (tx) => {
      const borrower = await tx.borrower.findFirst({
        where: { id, orgId, deletedAt: null },
      });

      if (!borrower) {
        throw new NotFoundException('Borrower not found');
      }

      const activeLoans = await tx.loan.count({
        where: {
          orgId,
          borrowerId: id,
          deletedAt: null,
          status: { in: [LoanStatus.ACTIVE, LoanStatus.IN_ARREARS] },
        },
      });

      if (activeLoans > 0) {
        throw new UnprocessableEntityException(
          'Cannot delete a borrower with active loans',
        );
      }

      await tx.borrower.update({
        where: { id },
        data: { deletedAt: new Date() },
      });

      await this.auditService.record(tx, {
        orgId,
        userId,
        action: 'borrower.deleted',
        entityType: 'BORROWER',
        entityId: id,
        before: { fullName: borrower.fullName, idNumber: borrower.idNumber },
      });

      return { message: 'Borrower deleted successfully' };
    });
  }

  private async buildSummary(
    tx: Parameters<Parameters<PrismaService['withOrgContext']>[2]>[0],
    orgId: string,
    borrowerId: string,
  ): Promise<BorrowerSummaryDto> {
    const loans = await tx.loan.findMany({
      where: {
        orgId,
        borrowerId,
        deletedAt: null,
        status: { in: [LoanStatus.ACTIVE, LoanStatus.IN_ARREARS] },
      },
      include: {
        repaymentSchedules: true,
        repayments: true,
      },
    });

    let totalOutstandingCents = 0;
    let loansInArrears = 0;

    for (const loan of loans) {
      const snapshot = this.loanBalanceService.computeFromData(
        loan.repaymentSchedules,
        loan.repayments,
        loan.status as LoanStatus,
      );
      totalOutstandingCents += snapshot.outstandingCents;
      if (snapshot.inArrears || loan.status === LoanStatus.IN_ARREARS) {
        loansInArrears += 1;
      }
    }

    return {
      totalLoans: loans.length,
      totalOutstandingFormatted: formatCents(totalOutstandingCents),
      loansInArrears,
    };
  }

  private computeBorrowerSummary(
    loans: {
      status: string;
      repaymentSchedules: { dueDate: Date; totalDueCents: number; periodNumber: number }[];
      repayments: { amountCents: number }[];
    }[],
  ): BorrowerSummaryDto {
    let totalOutstandingCents = 0;
    let loansInArrears = 0;

    for (const loan of loans) {
      const snapshot = this.loanBalanceService.computeFromData(
        loan.repaymentSchedules,
        loan.repayments,
        loan.status as LoanStatus,
      );
      totalOutstandingCents += snapshot.outstandingCents;
      if (snapshot.inArrears || loan.status === LoanStatus.IN_ARREARS) {
        loansInArrears += 1;
      }
    }

    return {
      totalLoans: loans.length,
      totalOutstandingFormatted: formatCents(totalOutstandingCents),
      loansInArrears,
    };
  }

  private mapListItem(row: {
    id: string;
    fullName: string;
    idNumber: string;
    phone: string;
    email: string | null;
    createdAt: Date;
  }): Omit<BorrowerListItemDto, 'summary'> {
    return {
      id: row.id,
      fullName: row.fullName,
      idNumber: row.idNumber,
      phone: row.phone,
      email: row.email,
      createdAt: row.createdAt.toISOString(),
    };
  }

  private mapDetail(
    row: {
      id: string;
      fullName: string;
      idNumber: string;
      phone: string;
      email: string | null;
      address: string | null;
      employer: string | null;
      monthlyIncomeCents: number | null;
      createdAt: Date;
      updatedAt: Date;
    },
    summary: BorrowerSummaryDto,
  ): BorrowerDetailDto {
    return {
      ...this.mapListItem(row),
      address: row.address,
      employer: row.employer,
      monthlyIncomeCents: row.monthlyIncomeCents,
      monthlyIncomeFormatted:
        row.monthlyIncomeCents != null
          ? formatCents(row.monthlyIncomeCents)
          : null,
      updatedAt: row.updatedAt.toISOString(),
      summary,
    };
  }
}
