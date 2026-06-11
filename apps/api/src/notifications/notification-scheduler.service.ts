import { Injectable, Logger } from '@nestjs/common';
import { LoanStatus } from '@lms/types';
import {
  computeDaysOverdue,
  isPeriodUnpaid,
  sumRepaymentCents,
} from '@lms/utils';
import { getEnv } from '../config/env';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationDispatchService } from './notification-dispatch.service';

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return startOfDay(result);
}

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

@Injectable()
export class NotificationSchedulerService {
  private readonly logger = new Logger(NotificationSchedulerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly dispatchService: NotificationDispatchService,
  ) {}

  async runRepaymentReminderScan(asOf: Date = new Date()): Promise<number> {
    if (!getEnv().CRON_REMINDER_ENABLED) {
      return 0;
    }

    const targetDueDate = addDays(startOfDay(asOf), 3);
    const targetDateStr = formatDate(targetDueDate);
    let enqueued = 0;

    const schedules = await this.prisma.withAuthLookup(async (tx) =>
      tx.repaymentSchedule.findMany({
        where: { dueDate: targetDueDate },
        include: {
          loan: {
            include: {
              organisation: true,
              borrower: true,
              repaymentSchedules: { orderBy: { periodNumber: 'asc' } },
              repayments: true,
            },
          },
        },
      }),
    );

    for (const schedule of schedules) {
      const loan = schedule.loan;
      if (
        !loan ||
        loan.deletedAt ||
        (loan.status !== LoanStatus.ACTIVE && loan.status !== LoanStatus.IN_ARREARS)
      ) {
        continue;
      }

      const totalPaidCents = sumRepaymentCents(loan.repayments);
      if (!isPeriodUnpaid(loan.repaymentSchedules, schedule.periodNumber, totalPaidCents)) {
        continue;
      }

      const platformUserId = loan.borrower.platformUserId;
      if (!platformUserId) {
        continue;
      }

      await this.dispatchService.notifyRepaymentReminder({
        orgId: loan.orgId,
        loanId: loan.id,
        borrowerUserId: platformUserId,
        organisationName: loan.organisation.name,
        dueDate: targetDateStr,
        amountCents: schedule.totalDueCents,
        periodNumber: schedule.periodNumber,
      });
      enqueued += 1;
    }

    this.logger.log(
      `Repayment reminder scan: ${enqueued} reminder(s) enqueued for due date ${targetDateStr}`,
    );

    return enqueued;
  }

  async notifyOverdueTransitions(
    orgId: string,
    transitions: {
      loanId: string;
      borrowerName: string;
      repaymentSchedules: { dueDate: Date; periodNumber: number; totalDueCents: number }[];
      repayments: { amountCents: number }[];
      outstandingCents: number;
    }[],
  ) {
    for (const transition of transitions) {
      const totalPaidCents = sumRepaymentCents(transition.repayments);
      const daysOverdue = computeDaysOverdue(
        transition.repaymentSchedules,
        totalPaidCents,
      );

      await this.dispatchService.notifyLoanOverdue({
        orgId,
        loanId: transition.loanId,
        borrowerName: transition.borrowerName,
        daysOverdue: Math.max(daysOverdue, 1),
        outstandingCents: transition.outstandingCents,
      });
    }
  }
}
