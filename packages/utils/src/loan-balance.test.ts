import { describe, expect, it } from 'vitest';
import { LoanStatus } from '@lms/types';
import {
  computeDaysOverdue,
  computeOutstandingBalanceCents,
  getUpcomingPeriods,
  isLoanInArrears,
  isPeriodUnpaid,
  resolveLoanStatus,
  sumScheduleTotalCents,
} from './loan-balance';

describe('loan balance helpers', () => {
  const schedule = [
    {
      periodNumber: 1,
      dueDate: new Date('2025-01-15'),
      totalDueCents: 100_000,
    },
    {
      periodNumber: 2,
      dueDate: new Date('2025-02-15'),
      totalDueCents: 100_000,
    },
  ];

  it('computes outstanding balance from schedule minus repayments', () => {
    expect(sumScheduleTotalCents(schedule)).toBe(200_000);
    expect(computeOutstandingBalanceCents(200_000, 50_000)).toBe(150_000);
    expect(computeOutstandingBalanceCents(200_000, 250_000)).toBe(0);
  });

  it('detects arrears when past-due amounts are underpaid', () => {
    expect(
      isLoanInArrears(schedule, 50_000, 150_000, new Date('2025-02-20')),
    ).toBe(true);
    expect(
      isLoanInArrears(schedule, 200_000, 0, new Date('2025-02-20')),
    ).toBe(false);
  });

  it('resolves completed status when outstanding is zero', () => {
    expect(
      resolveLoanStatus(LoanStatus.ACTIVE, 0, false),
    ).toBe(LoanStatus.COMPLETED);
  });

  it('keeps draft status unchanged', () => {
    expect(resolveLoanStatus(LoanStatus.DRAFT, 100_000, true)).toBe(
      LoanStatus.DRAFT,
    );
  });

  it('detects unpaid periods from cumulative schedule totals', () => {
    expect(isPeriodUnpaid(schedule, 1, 50_000)).toBe(true);
    expect(isPeriodUnpaid(schedule, 1, 100_000)).toBe(false);
    expect(isPeriodUnpaid(schedule, 2, 150_000)).toBe(true);
  });

  it('computes days overdue from earliest unpaid past-due period', () => {
    expect(computeDaysOverdue(schedule, 50_000, new Date('2025-01-20'))).toBe(
      5,
    );
    expect(computeDaysOverdue(schedule, 200_000, new Date('2025-02-20'))).toBe(
      0,
    );
  });

  it('lists upcoming unpaid periods within a window', () => {
    const upcoming = getUpcomingPeriods(
      schedule,
      50_000,
      60,
      new Date('2025-01-10'),
    );
    expect(upcoming.map((period) => period.periodNumber)).toEqual([1, 2]);
  });
});
