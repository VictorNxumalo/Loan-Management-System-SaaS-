import { Injectable, Logger } from '@nestjs/common';
import type { OverdueSweepResultDto } from '@lms/types';
import { LoanStatus } from '@lms/types';
import { LoanBalanceService } from '../loans/loan-balance.service';
import { NotificationSchedulerService } from '../notifications/notification-scheduler.service';
import { PrismaService } from '../prisma/prisma.service';

export interface OverdueTransition {
  loanId: string;
  borrowerName: string;
  repaymentSchedules: { dueDate: Date; periodNumber: number; totalDueCents: number }[];
  repayments: { amountCents: number }[];
  outstandingCents: number;
}

@Injectable()
export class OverdueSweepService {
  private readonly logger = new Logger(OverdueSweepService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly loanBalanceService: LoanBalanceService,
    private readonly notificationScheduler: NotificationSchedulerService,
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

      if (result.overdueTransitions.length > 0) {
        await this.notificationScheduler.notifyOverdueTransitions(
          org.id,
          result.overdueTransitions,
        );
      }
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
  ): Promise<{
    loansChecked: number;
    loansUpdated: number;
    overdueTransitions: OverdueTransition[];
  }> {
    const actor = await this.prisma.withAuthLookup(async (tx) =>
      tx.user.findFirst({
        where: { orgId, deletedAt: null, isActive: true },
        orderBy: { createdAt: 'asc' },
      }),
    );

    if (!actor) {
      return { loansChecked: 0, loansUpdated: 0, overdueTransitions: [] };
    }

    const overdueTransitions: OverdueTransition[] = [];

    const result = await this.prisma.withOrgContext(orgId, actor.id, async (tx) => {
      const loans = await tx.loan.findMany({
        where: {
          orgId,
          deletedAt: null,
          status: { in: [LoanStatus.ACTIVE, LoanStatus.IN_ARREARS] },
        },
        include: {
          borrower: true,
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

          if (snapshot.resolvedStatus === LoanStatus.IN_ARREARS) {
            overdueTransitions.push({
              loanId: loan.id,
              borrowerName: loan.borrower.fullName,
              repaymentSchedules: loan.repaymentSchedules,
              repayments: loan.repayments,
              outstandingCents: snapshot.outstandingCents,
            });
          }
        }
      }

      return { loansChecked: loans.length, loansUpdated };
    });

    return { ...result, overdueTransitions };
  }
}
