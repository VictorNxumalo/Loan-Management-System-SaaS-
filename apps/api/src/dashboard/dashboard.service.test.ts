import { LoanStatus } from '@lms/types';
import { describe, expect, it, vi } from 'vitest';
import { LoanBalanceService } from '../loans/loan-balance.service';
import { DashboardService } from './dashboard.service';

describe('DashboardService', () => {
  const loanBalanceService = new LoanBalanceService();

  it('aggregates KPIs and lists upcoming/overdue loans', async () => {
    const loan = {
      id: 'loan-1',
      borrowerId: 'borrower-1',
      status: LoanStatus.ACTIVE,
      borrower: { fullName: 'Jane Doe' },
      repaymentSchedules: [
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
      ],
      repayments: [{ amountCents: 50_000 }],
    };

    const prisma = {
      withOrgContext: vi.fn(
        async (_orgId: string, _userId: string, fn: (tx: unknown) => Promise<unknown>) =>
          fn({
            loan: {
              findMany: vi.fn().mockResolvedValue([loan]),
            },
            repayment: {
              aggregate: vi.fn().mockResolvedValue({
                _sum: { amountCents: 25_000 },
              }),
            },
          }),
      ),
    };

    const service = new DashboardService(
      prisma as never,
      loanBalanceService,
    );

    const result = await service.getDashboard(
      'org-1',
      'user-1',
      new Date('2025-01-20'),
    );

    expect(result.kpis.activeLoans).toBe(1);
    expect(result.kpis.portfolioValueFormatted).toMatch(/R/);
    expect(result.kpis.repaymentsThisMonthFormatted).toMatch(/R/);
    expect(result.kpis.loansInArrears).toBe(1);
    expect(result.kpis.arrearsRatePercent).toBe(100);
    expect(result.upcoming7Days).toHaveLength(0);
    expect(result.upcoming30Days).toHaveLength(1);
    expect(result.overdueLoans).toHaveLength(1);
    expect(result.overdueLoans[0]?.daysOverdue).toBe(5);
  });
});
