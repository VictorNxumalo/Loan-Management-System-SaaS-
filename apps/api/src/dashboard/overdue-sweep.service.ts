import { Injectable, Logger } from '@nestjs/common';
import type { OverdueSweepResultDto } from '@lms/types';
import { LoanStatus } from '@lms/types';
import { LoanBalanceService } from '../loans/loan-balance.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class OverdueSweepService {
  private readonly logger = new Logger(OverdueSweepService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly loanBalanceService: LoanBalanceService,
  ) {}

  async sweepAllOrganisations(asOf: Date = new Date()): Promise<OverdueSweepResultDto> {
    const organisations = await this.prisma.withAuthLookup(async (tx) =>
      tx.organisation.findMany({
        where: { deletedAt: null },
        select: { id: true },
      }),
    );

    let loansChecked = 0;
    let loansUpdated = 0;

    for (const org of organisations) {
      const result = await this.sweepOrganisation(org.id, asOf);
      loansChecked += result.loansChecked;
      loansUpdated += result.loansUpdated;
    }

    this.logger.log(
      `Overdue sweep complete: ${organisations.length} orgs, ${loansChecked} loans checked, ${loansUpdated} updated`,
    );

    return {
      organisationsProcessed: organisations.length,
      loansChecked,
      loansUpdated,
    };
  }

  async sweepOrganisation(
    orgId: string,
    asOf: Date = new Date(),
  ): Promise<{ loansChecked: number; loansUpdated: number }> {
    const actor = await this.prisma.withAuthLookup(async (tx) =>
      tx.user.findFirst({
        where: { orgId, deletedAt: null, isActive: true },
        orderBy: { createdAt: 'asc' },
      }),
    );

    if (!actor) {
      return { loansChecked: 0, loansUpdated: 0 };
    }

    return this.prisma.withOrgContext(orgId, actor.id, async (tx) => {
      const loans = await tx.loan.findMany({
        where: {
          deletedAt: null,
          status: { in: [LoanStatus.ACTIVE, LoanStatus.IN_ARREARS] },
        },
        include: {
          repaymentSchedules: { orderBy: { periodNumber: 'asc' } },
          repayments: true,
        },
      });

      let loansUpdated = 0;

      for (const loan of loans) {
        const snapshot = this.loanBalanceService.computeFromData(
          loan.repaymentSchedules,
          loan.repayments,
          loan.status,
          asOf,
        );

        if (snapshot.resolvedStatus !== loan.status) {
          await tx.loan.update({
            where: { id: loan.id },
            data: { status: snapshot.resolvedStatus },
          });
          loansUpdated += 1;
        }
      }

      return { loansChecked: loans.length, loansUpdated };
    });
  }
}
