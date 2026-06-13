import { Injectable } from '@nestjs/common';
import type {
  DashboardDto,
  OverdueLoanDto,
  UpcomingRepaymentDto,
} from '@lms/types';
import { LoanStatus } from '@lms/types';
import {
  computeDaysOverdue,
  getUpcomingPeriods,
  isLoanInArrears,
  startOfDay,
} from '@lms/utils';
import { formatCents } from '../common/money';
import { LoanBalanceService } from '../loans/loan-balance.service';
import { PrismaService } from '../prisma/prisma.service';
import { WalletsService } from '../wallets/wallets.service';

@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly loanBalanceService: LoanBalanceService,
    private readonly walletsService: WalletsService,
  ) {}

  async getDashboard(
    orgId: string,
    userId: string,
    asOf: Date = new Date(),
  ): Promise<DashboardDto> {
    return this.prisma.withOrgContext(orgId, userId, async (tx) => {
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

      const monthStart = new Date(asOf.getFullYear(), asOf.getMonth(), 1);
      const monthEnd = new Date(asOf.getFullYear(), asOf.getMonth() + 1, 0);

      const repaymentsThisMonth = await tx.repayment.aggregate({
        where: {
          orgId,
          paymentDate: { gte: monthStart, lte: monthEnd },
        },
        _sum: { amountCents: true },
      });

      let receivablesCents = 0;
      let loansInArrears = 0;
      const upcoming7: UpcomingRepaymentDto[] = [];
      const upcoming30: UpcomingRepaymentDto[] = [];
      const overdueLoans: OverdueLoanDto[] = [];

      for (const loan of loans) {
        const snapshot = this.loanBalanceService.computeFromData(
          loan.repaymentSchedules,
          loan.repayments,
          loan.status,
          asOf,
        );

        receivablesCents += snapshot.outstandingCents;

        const inArrears =
          snapshot.inArrears || loan.status === LoanStatus.IN_ARREARS;
        if (inArrears) {
          loansInArrears += 1;
        }

        const schedule = loan.repaymentSchedules.map((period) => ({
          periodNumber: period.periodNumber,
          dueDate: period.dueDate,
          totalDueCents: period.totalDueCents,
        }));

        const totalPaidCents = snapshot.totalPaidCents;

        for (const period of getUpcomingPeriods(schedule, totalPaidCents, 7, asOf)) {
          upcoming7.push(
            this.mapUpcoming(loan, period.periodNumber, period.dueDate, period.totalDueCents),
          );
        }

        for (const period of getUpcomingPeriods(schedule, totalPaidCents, 30, asOf)) {
          upcoming30.push(
            this.mapUpcoming(loan, period.periodNumber, period.dueDate, period.totalDueCents),
          );
        }

        const daysOverdue = computeDaysOverdue(schedule, totalPaidCents, asOf);
        if (
          inArrears &&
          daysOverdue > 0 &&
          isLoanInArrears(
            schedule,
            totalPaidCents,
            snapshot.outstandingCents,
            asOf,
          )
        ) {
          const oldestDue = this.findOldestOverdueDueDate(schedule, totalPaidCents, asOf);
          overdueLoans.push({
            loanId: loan.id,
            borrowerId: loan.borrowerId,
            borrowerName: loan.borrower.fullName,
            outstandingBalanceFormatted: formatCents(snapshot.outstandingCents),
            daysOverdue,
            oldestOverdueDueDate: oldestDue.toISOString().slice(0, 10),
            loanStatus: loan.status,
          });
        }
      }

      upcoming7.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
      upcoming30.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
      overdueLoans.sort((a, b) => b.daysOverdue - a.daysOverdue);

      const activeLoans = loans.length;
      const arrearsRatePercent =
        activeLoans === 0
          ? 0
          : Math.round((loansInArrears / activeLoans) * 1000) / 10;

      const walletInfo = await this.walletsService.getOrgAvailableBalanceCents(
        tx,
        orgId,
      );

      return {
        kpis: {
          activeLoans,
          receivablesFormatted: formatCents(receivablesCents),
          receivablesCents,
          availableFundsFormatted: formatCents(walletInfo.balanceCents),
          availableFundsCents: walletInfo.balanceCents,
          walletConfigured: walletInfo.configured,
          walletBankLinked: walletInfo.bankLinked,
          repaymentsThisMonthFormatted: formatCents(
            repaymentsThisMonth._sum.amountCents ?? 0,
          ),
          loansInArrears,
          arrearsRatePercent,
        },
        upcoming7Days: upcoming7,
        upcoming30Days: upcoming30,
        overdueLoans,
      };
    });
  }

  private mapUpcoming(
    loan: {
      id: string;
      borrowerId: string;
      status: string;
      borrower: { fullName: string };
    },
    periodNumber: number,
    dueDate: Date,
    totalDueCents: number,
  ): UpcomingRepaymentDto {
    return {
      loanId: loan.id,
      borrowerId: loan.borrowerId,
      borrowerName: loan.borrower.fullName,
      periodNumber,
      dueDate: dueDate.toISOString().slice(0, 10),
      amountDueFormatted: formatCents(totalDueCents),
      loanStatus: loan.status,
    };
  }

  private findOldestOverdueDueDate(
    schedule: { periodNumber: number; dueDate: Date; totalDueCents: number }[],
    totalPaidCents: number,
    asOf: Date,
  ): Date {
    const today = startOfDay(asOf);
    let oldest: Date | null = null;

    for (const period of schedule) {
      if (startOfDay(period.dueDate) >= today) {
        continue;
      }
      const cumulative = schedule
        .filter((p) => p.periodNumber <= period.periodNumber)
        .reduce((sum, p) => sum + p.totalDueCents, 0);
      if (totalPaidCents >= cumulative) {
        continue;
      }
      if (!oldest || period.dueDate < oldest) {
        oldest = period.dueDate;
      }
    }

    return oldest ?? today;
  }
}
