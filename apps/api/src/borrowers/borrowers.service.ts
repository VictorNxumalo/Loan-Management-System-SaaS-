import {
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
  SearchBorrowersQuery,
  UpdateBorrowerInput,
} from '@lms/types';
import { LoanStatus } from '@lms/types';
import { formatCents } from '../common/money';
import { LoanBalanceService } from '../loans/loan-balance.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class BorrowersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly loanBalanceService: LoanBalanceService,
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
          orderBy: { fullName: 'asc' },
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

  async create(
    orgId: string,
    userId: string,
    input: CreateBorrowerInput,
  ): Promise<BorrowerDetailDto> {
    const email = input.email?.trim() || null;

    try {
      return await this.prisma.withOrgContext(orgId, userId, async (tx) => {
        const created = await tx.borrower.create({
          data: {
            orgId,
            fullName: input.fullName.trim(),
            idNumber: input.idNumber.trim(),
            phone: input.phone.trim(),
            email,
            address: input.address?.trim() || null,
            employer: input.employer?.trim() || null,
            monthlyIncomeCents: input.monthlyIncomeCents ?? null,
          },
        });

        return this.mapDetail(created, {
          totalLoans: 0,
          totalOutstandingFormatted: formatCents(0),
          loansInArrears: 0,
        });
      });
    } catch {
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

        const summary = await this.buildSummary(tx, orgId, id);
        return this.mapDetail(updated, summary);
      } catch {
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
        loan.status,
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
  }): BorrowerListItemDto {
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
