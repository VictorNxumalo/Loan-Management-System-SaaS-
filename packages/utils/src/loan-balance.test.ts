import { describe, expect, it } from 'vitest';
import { LoanStatus } from '@lms/types';
import {
  computeOutstandingBalanceCents,
  isLoanInArrears,
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
});
