'use client';

import type { DashboardDto, PaginatedBorrowersDto, PaginatedLoanApplicationsDto } from '@lms/types';
import {
  AlertTriangle,
  CalendarClock,
  FileText,
  PiggyBank,
  TrendingUp,
  Users,
  Wallet,
} from 'lucide-react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';
import { ActivityList, ActivityRow } from '@/components/overview/activity-row';
import {
  OverviewEmptyState,
  OverviewSection,
} from '@/components/overview/overview-section';
import { OverviewTile, OverviewTileGrid } from '@/components/overview/overview-tile';
import { KpiSkeletonGrid } from '@/components/brand/skeleton';
import { Reveal } from '@/components/brand/reveal';
import { PageHeader } from '@/components/page-header';
import { ReportsExportPanel } from '@/components/reports-export-panel';
import { LoanStatusBadge } from '@/components/loan-status-badge';
import { useApi } from '@/lib/use-api';
import { useAuthenticatedQuery } from '@/lib/use-authenticated-query';

export default function DashboardPage() {
  const { data: session } = useSession();
  const api = useApi();
  const [data, setData] = useState<DashboardDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const applicationsQuery = useAuthenticatedQuery<PaginatedLoanApplicationsDto>(
    '/applications?limit=1',
  );
  const borrowersQuery = useAuthenticatedQuery<PaginatedBorrowersDto>('/borrowers?limit=1');

  useEffect(() => {
    void api<DashboardDto>('/dashboard')
      .then(setData)
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [api]);

  const firstName = session?.user?.name?.split(' ')[0] ?? 'there';

  return (
    <div className="space-y-6 pb-8">
      <Reveal>
        <PageHeader
          title="Overview"
          description={`Welcome back, ${firstName}. Tap any metric to see the full details.`}
        />
      </Reveal>

      {error && (
        <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </p>
      )}

      {loading && !error && <KpiSkeletonGrid count={8} />}

      {data && (
        <>
          <Reveal delay={50}>
            <OverviewTileGrid>
              <OverviewTile
                href="/dashboard/wallet"
                title="Available funds"
                description="Wallet balance linked to your bank account"
                value={data.kpis.availableFundsFormatted}
                icon={Wallet}
                footer={
                  !data.kpis.walletConfigured || !data.kpis.walletBankLinked ? (
                    <span className="text-xs font-medium text-primary">Set up wallet →</span>
                  ) : undefined
                }
              />
              <OverviewTile
                href="/dashboard/loans"
                title="Receivables"
                description="Total outstanding from active loans"
                value={data.kpis.receivablesFormatted}
                icon={TrendingUp}
              />
              <OverviewTile
                href="/dashboard/loans"
                title="Active loans"
                description="Currently active or in arrears"
                value={String(data.kpis.activeLoans)}
                icon={PiggyBank}
              />
              <OverviewTile
                href="/dashboard/loans"
                title="Collected this month"
                description="Repayments received in the current month"
                value={data.kpis.repaymentsThisMonthFormatted}
                icon={CalendarClock}
              />
              <OverviewTile
                href="/dashboard/loans"
                title="Loans in arrears"
                description="Past due — review and follow up"
                value={String(data.kpis.loansInArrears)}
                icon={AlertTriangle}
                variant={data.kpis.loansInArrears > 0 ? 'alert' : 'default'}
              />
              <OverviewTile
                href="/dashboard/loans"
                title="Arrears rate"
                description="Share of active loans that are overdue"
                value={`${data.kpis.arrearsRatePercent}%`}
                icon={AlertTriangle}
                variant={data.kpis.arrearsRatePercent > 0 ? 'alert' : 'muted'}
              />
              <OverviewTile
                href="/dashboard/applications"
                title="Applications"
                description="Review and approve borrower requests"
                value={String(applicationsQuery.data?.total ?? '—')}
                icon={FileText}
                variant="muted"
              />
              <OverviewTile
                href="/dashboard/borrowers"
                title="People I lend to"
                description="Borrowers in your workspace"
                value={String(borrowersQuery.data?.total ?? '—')}
                icon={Users}
                variant="muted"
              />
            </OverviewTileGrid>
          </Reveal>

          <Reveal delay={100}>
            <ReportsExportPanel />
          </Reveal>

          <Reveal delay={120}>
            <OverviewSection
              title="Due in the next 7 days"
              description="Upcoming repayments requiring attention"
              href="/dashboard/loans"
            >
              {data.upcoming7Days.length === 0 ? (
                <OverviewEmptyState message="No repayments due in the next 7 days." />
              ) : (
                <ActivityList>
                  {data.upcoming7Days.slice(0, 6).map((item) => (
                    <ActivityRow
                      key={`${item.loanId}-${item.periodNumber}`}
                      href={`/dashboard/loans/${item.loanId}`}
                      title={item.borrowerName}
                      subtitle={`Period ${item.periodNumber} · Due ${item.dueDate}`}
                      meta={item.loanStatus}
                      trailing={
                        <span className="font-semibold text-brand-green">
                          {item.amountDueFormatted}
                        </span>
                      }
                    />
                  ))}
                </ActivityList>
              )}
            </OverviewSection>
          </Reveal>

          <Reveal delay={140}>
            <OverviewSection
              title="Due in the next 30 days"
              description="Broader repayment horizon"
              href="/dashboard/loans"
            >
              {data.upcoming30Days.length === 0 ? (
                <OverviewEmptyState message="No repayments due in the next 30 days." />
              ) : (
                <ActivityList>
                  {data.upcoming30Days.slice(0, 6).map((item) => (
                    <ActivityRow
                      key={`${item.loanId}-${item.periodNumber}`}
                      href={`/dashboard/loans/${item.loanId}`}
                      title={item.borrowerName}
                      subtitle={`Period ${item.periodNumber} · Due ${item.dueDate}`}
                      trailing={
                        <span className="font-medium">{item.amountDueFormatted}</span>
                      }
                    />
                  ))}
                </ActivityList>
              )}
            </OverviewSection>
          </Reveal>

          <Reveal delay={160}>
            <OverviewSection
              title="Overdue loans"
              description="Sorted by days overdue — tap to open the loan"
              href="/dashboard/loans"
            >
              {data.overdueLoans.length === 0 ? (
                <OverviewEmptyState message="No overdue loans — your portfolio is on track." />
              ) : (
                <ActivityList>
                  {data.overdueLoans.map((item) => (
                    <ActivityRow
                      key={item.loanId}
                      href={`/dashboard/loans/${item.loanId}`}
                      title={item.borrowerName}
                      subtitle={`${item.daysOverdue} days overdue · Oldest due ${item.oldestOverdueDueDate}`}
                      variant="alert"
                      trailing={
                        <div className="space-y-1">
                          <p className="font-semibold text-destructive">
                            {item.outstandingBalanceFormatted}
                          </p>
                          <LoanStatusBadge status={item.loanStatus} />
                        </div>
                      }
                    />
                  ))}
                </ActivityList>
              )}
            </OverviewSection>
          </Reveal>

          <Reveal delay={180}>
            <div className="rounded-xl border border-dashed border-border/80 bg-muted/20 px-4 py-3 text-center text-sm text-muted-foreground">
              Need deeper detail? Use{' '}
              <Link href="/dashboard/wallet" className="font-medium text-primary hover:underline">
                Wallet
              </Link>
              ,{' '}
              <Link href="/dashboard/loans" className="font-medium text-primary hover:underline">
                Loans
              </Link>
              , or{' '}
              <Link
                href="/dashboard/applications"
                className="font-medium text-primary hover:underline"
              >
                Applications
              </Link>{' '}
              from the menu.
            </div>
          </Reveal>
        </>
      )}
    </div>
  );
}
