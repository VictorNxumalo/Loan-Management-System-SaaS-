'use client';

import type {
  BorrowerLendingStatusDto,
  MarketplaceLenderDto,
  PaginatedBorrowerLoansDto,
  PaginatedLoanApplicationsDto,
  WalletSummaryDto,
} from '@lms/types';
import {
  AlertTriangle,
  FileText,
  Handshake,
  PiggyBank,
  Search,
  Wallet,
} from 'lucide-react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { useMemo } from 'react';
import { ApplicationStatusBadge } from '@/components/application-status-badge';
import { KpiSkeletonGrid } from '@/components/brand/skeleton';
import { Reveal } from '@/components/brand/reveal';
import { ActivityList, ActivityRow } from '@/components/overview/activity-row';
import {
  OverviewEmptyState,
  OverviewSection,
} from '@/components/overview/overview-section';
import { OverviewTile, OverviewTileGrid } from '@/components/overview/overview-tile';
import { LoanStatusBadge } from '@/components/loan-status-badge';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import {
  aggregateBorrowerApplications,
  aggregateBorrowerLoans,
} from '@/lib/borrower-overview';
import { useAuthenticatedQuery } from '@/lib/use-authenticated-query';

export default function BorrowerHomePage() {
  const { data: session } = useSession();
  const walletQuery = useAuthenticatedQuery<WalletSummaryDto>('/borrower/wallet');
  const loansQuery = useAuthenticatedQuery<PaginatedBorrowerLoansDto>(
    '/borrower/loans?limit=50',
  );
  const applicationsQuery = useAuthenticatedQuery<PaginatedLoanApplicationsDto>(
    '/borrower/applications?limit=50',
  );
  const lendersQuery = useAuthenticatedQuery<MarketplaceLenderDto[]>('/borrower/lenders');
  const lendingStatusQuery = useAuthenticatedQuery<BorrowerLendingStatusDto>(
    '/borrower/lending-status',
  );

  const loading =
    walletQuery.loading ||
    loansQuery.loading ||
    applicationsQuery.loading ||
    lendersQuery.loading;

  const error =
    walletQuery.error ?? loansQuery.error ?? applicationsQuery.error ?? lendersQuery.error;

  const loans = loansQuery.data?.items ?? [];
  const applications = applicationsQuery.data?.items ?? [];
  const lenders = lendersQuery.data ?? [];
  const wallet = walletQuery.data;
  const canStartNewApplication =
    lendingStatusQuery.data?.canStartNewApplication !== false;

  const loanStats = useMemo(() => aggregateBorrowerLoans(loans), [loans]);
  const applicationStats = useMemo(
    () => aggregateBorrowerApplications(applications),
    [applications],
  );

  const firstName = session?.user?.name?.split(' ')[0] ?? 'there';

  return (
    <div className="space-y-6 pb-8">
      <Reveal>
        <PageHeader
          title="Overview"
          description={`Welcome back, ${firstName}. Your wallet, loans, and applications at a glance.`}
          actions={
            <Button asChild size="sm" className="hidden sm:inline-flex">
              <Link href="/borrower/lenders/browse">Find a lender</Link>
            </Button>
          }
        />
      </Reveal>

      {error && (
        <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </p>
      )}

      {loading && !error && <KpiSkeletonGrid count={6} />}

      {!loading && !error && (
        <>
          <Reveal delay={50}>
            <OverviewTileGrid>
              <OverviewTile
                href="/borrower/wallet"
                title="Wallet balance"
                description="Funds available in your LMS wallet"
                value={wallet?.availableBalanceFormatted ?? 'R 0.00'}
                icon={Wallet}
                footer={
                  wallet && (!wallet.walletConfigured || !wallet.walletBankLinked) ? (
                    <span className="text-xs font-medium text-primary">Link bank account →</span>
                  ) : undefined
                }
              />
              <OverviewTile
                href="/borrower/loans"
                title="Total outstanding"
                description="Across active and pending loans"
                value={loanStats.totalOutstandingFormatted}
                icon={PiggyBank}
              />
              <OverviewTile
                href="/borrower/loans"
                title="Active loans"
                description="Loans currently in progress"
                value={String(loanStats.activeLoans)}
                icon={PiggyBank}
              />
              <OverviewTile
                href="/borrower/loans"
                title="In arrears"
                description="Loans with overdue repayments"
                value={String(loanStats.loansInArrears)}
                icon={AlertTriangle}
                variant={loanStats.loansInArrears > 0 ? 'alert' : 'default'}
              />
              <OverviewTile
                href="/borrower/applications"
                title="Open applications"
                description="Draft or submitted, awaiting review"
                value={String(applicationStats.openApplications)}
                icon={FileText}
              />
              <OverviewTile
                href="/borrower/lenders/mine"
                title="My lenders"
                description="Organisations you are connected with"
                value={String(lenders.length)}
                icon={Handshake}
              />
            </OverviewTileGrid>
          </Reveal>

          <Reveal delay={80}>
            <div className="grid gap-3 sm:grid-cols-2">
              <Link
                href="/borrower/lenders/browse"
                className="lms-surface-interactive flex items-center gap-3 rounded-xl border p-4 touch-manipulation sm:hidden"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-green/10 text-brand-green">
                  <Search className="h-5 w-5" aria-hidden="true" />
                </div>
                <div>
                  <p className="font-semibold text-brand-navy">Browse lenders</p>
                  <p className="text-xs text-muted-foreground">
                    Discover organisations on the marketplace
                  </p>
                </div>
              </Link>
              {canStartNewApplication ? (
                <Link
                  href="/borrower/lenders/mine"
                  className="lms-surface-interactive flex items-center gap-3 rounded-xl border p-4 touch-manipulation"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-green/10 text-brand-green">
                    <FileText className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <div>
                    <p className="font-semibold text-brand-navy">New application</p>
                    <p className="text-xs text-muted-foreground">
                      Apply to a connected lender
                    </p>
                  </div>
                </Link>
              ) : (
                <Link
                  href="/borrower/applications"
                  className="lms-surface-interactive flex items-center gap-3 rounded-xl border p-4 touch-manipulation"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-green/10 text-brand-green">
                    <FileText className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <div>
                    <p className="font-semibold text-brand-navy">My applications</p>
                    <p className="text-xs text-muted-foreground">
                      Continue or track your open application
                    </p>
                  </div>
                </Link>
              )}
            </div>
          </Reveal>

          <Reveal delay={100}>
            <OverviewSection
              title="My loans"
              description="Tap a loan for schedule, repayments, and pay options"
              href="/borrower/loans"
            >
              {loanStats.recentLoans.length === 0 ? (
                <OverviewEmptyState message="No loans yet. Once a lender approves your application, your loan will appear here." />
              ) : (
                <ActivityList>
                  {loanStats.recentLoans.map((loan) => (
                    <ActivityRow
                      key={loan.id}
                      href={`/borrower/loans/${loan.id}`}
                      title={loan.organisationName}
                      subtitle={`${loan.principalFormatted} · Started ${loan.startDate}`}
                      trailing={
                        <div className="space-y-1 text-right">
                          <p className="font-semibold text-brand-green">
                            {loan.outstandingBalanceFormatted}
                          </p>
                          <LoanStatusBadge status={loan.status} />
                        </div>
                      }
                    />
                  ))}
                </ActivityList>
              )}
            </OverviewSection>
          </Reveal>

          <Reveal delay={120}>
            <OverviewSection
              title="Applications"
              description="Track requests you have sent to lenders"
              href="/borrower/applications"
            >
              {applicationStats.recentApplications.length === 0 ? (
                <OverviewEmptyState message="No applications yet. Connect with a lender, then submit a loan request." />
              ) : (
                <ActivityList>
                  {applicationStats.recentApplications.map((application) => (
                    <ActivityRow
                      key={application.id}
                      href={`/borrower/applications/${application.id}`}
                      title={application.organisationName}
                      subtitle={`${application.principalFormatted} · ${application.termPeriods} payments`}
                      trailing={<ApplicationStatusBadge status={application.status} />}
                    />
                  ))}
                </ActivityList>
              )}
            </OverviewSection>
          </Reveal>

          <Reveal delay={140}>
            <OverviewSection
              title="Connected lenders"
              description="Organisations you can apply to or borrow from"
              href="/borrower/lenders/mine"
            >
              {lenders.length === 0 ? (
                <div className="space-y-3">
                  <OverviewEmptyState message="You have not connected with any lenders yet." />
                  <Button asChild variant="outline" size="sm">
                    <Link href="/borrower/lenders/browse">Browse lender directory</Link>
                  </Button>
                </div>
              ) : (
                <ActivityList>
                  {lenders.slice(0, 5).map((lender) => (
                    <ActivityRow
                      key={lender.id}
                      href="/borrower/lenders/mine"
                      title={lender.name}
                      subtitle={lender.profile.categoryLabel}
                      meta={lender.profile.description ?? undefined}
                    />
                  ))}
                </ActivityList>
              )}
            </OverviewSection>
          </Reveal>
        </>
      )}
    </div>
  );
}
