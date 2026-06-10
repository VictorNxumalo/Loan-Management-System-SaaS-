import type { LoanStatus } from '@lms/types';
import { LoanStatus as LoanStatusEnum } from '@lms/types';

export interface SchedulePeriodCents {
  periodNumber: number;
  dueDate: Date;
  totalDueCents: number;
}

export function sumScheduleTotalCents(
  schedule: { totalDueCents: number }[],
): number {
  return schedule.reduce((sum, period) => sum + period.totalDueCents, 0);
}

export function sumRepaymentCents(
  repayments: { amountCents: number }[],
): number {
  return repayments.reduce((sum, repayment) => sum + repayment.amountCents, 0);
}

export function computeOutstandingBalanceCents(
  totalScheduledCents: number,
  totalPaidCents: number,
): number {
  return Math.max(0, totalScheduledCents - totalPaidCents);
}

export function computeCumulativeDueCents(
  schedule: SchedulePeriodCents[],
  asOf: Date = new Date(),
): number {
  const today = startOfDay(asOf);
  return schedule.reduce((sum, period) => {
    if (startOfDay(period.dueDate) <= today) {
      return sum + period.totalDueCents;
    }
    return sum;
  }, 0);
}

export function isLoanInArrears(
  schedule: SchedulePeriodCents[],
  totalPaidCents: number,
  outstandingCents: number,
  asOf: Date = new Date(),
): boolean {
  if (outstandingCents === 0) {
    return false;
  }
  const cumulativeDue = computeCumulativeDueCents(schedule, asOf);
  return totalPaidCents < cumulativeDue;
}

export function resolveLoanStatus(
  currentStatus: LoanStatus,
  outstandingCents: number,
  inArrears: boolean,
): LoanStatus {
  if (currentStatus === LoanStatusEnum.DRAFT) {
    return LoanStatusEnum.DRAFT;
  }

  if (outstandingCents === 0) {
    return LoanStatusEnum.COMPLETED;
  }

  if (inArrears) {
    return LoanStatusEnum.IN_ARREARS;
  }

  if (currentStatus === LoanStatusEnum.COMPLETED) {
    return LoanStatusEnum.COMPLETED;
  }

  return LoanStatusEnum.ACTIVE;
}

export function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function getCumulativeDueThroughPeriod(
  schedule: SchedulePeriodCents[],
  periodNumber: number,
): number {
  return schedule
    .filter((period) => period.periodNumber <= periodNumber)
    .reduce((sum, period) => sum + period.totalDueCents, 0);
}

export function isPeriodUnpaid(
  schedule: SchedulePeriodCents[],
  periodNumber: number,
  totalPaidCents: number,
): boolean {
  return totalPaidCents < getCumulativeDueThroughPeriod(schedule, periodNumber);
}

export function computeDaysOverdue(
  schedule: SchedulePeriodCents[],
  totalPaidCents: number,
  asOf: Date = new Date(),
): number {
  const today = startOfDay(asOf);
  let earliestOverdue: Date | null = null;

  for (const period of schedule) {
    if (startOfDay(period.dueDate) >= today) {
      continue;
    }
    if (!isPeriodUnpaid(schedule, period.periodNumber, totalPaidCents)) {
      continue;
    }
    if (!earliestOverdue || period.dueDate < earliestOverdue) {
      earliestOverdue = period.dueDate;
    }
  }

  if (!earliestOverdue) {
    return 0;
  }

  const diffMs = today.getTime() - startOfDay(earliestOverdue).getTime();
  return Math.max(0, Math.floor(diffMs / 86_400_000));
}

export function getUpcomingPeriods(
  schedule: SchedulePeriodCents[],
  totalPaidCents: number,
  daysAhead: number,
  asOf: Date = new Date(),
): SchedulePeriodCents[] {
  const today = startOfDay(asOf);
  const end = new Date(today);
  end.setDate(end.getDate() + daysAhead);

  return schedule.filter((period) => {
    const due = startOfDay(period.dueDate);
    if (due < today || due > end) {
      return false;
    }
    return isPeriodUnpaid(schedule, period.periodNumber, totalPaidCents);
  });
}
