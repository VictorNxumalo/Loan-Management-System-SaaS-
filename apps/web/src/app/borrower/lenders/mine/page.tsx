'use client';

import type { MarketplaceLenderDto, PaginatedLoanApplicationsDto } from '@lms/types';
import Link from 'next/link';
import { CardSkeleton } from '@/components/brand/skeleton';
import { BorrowerLendingStatusBanner } from '@/components/borrower-lending-status-banner';
import { EmptyState } from '@/components/empty-state';
import { LenderAvatar } from '@/components/lender-avatar';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { useAuthenticatedQuery } from '@/lib/use-authenticated-query';

export default function MyLendersPage() {
  const { data, error, loading, refetch } = useAuthenticatedQuery<MarketplaceLenderDto[]>(
    '/borrower/lenders',
  );
  const { data: lendingStatus } = useAuthenticatedQuery<{
    canStartNewApplication: boolean;
    committedOrgId: string | null;
    message: string | null;
  }>('/borrower/lending-status');
  const { data: applicationsData } = useAuthenticatedQuery<PaginatedLoanApplicationsDto>(
    '/borrower/applications?limit=50',
  );

  const lenders = data ?? [];
  const draftByOrgId = new Map(
    (applicationsData?.items ?? [])
      .filter((item) => item.status === 'DRAFT')
      .map((item) => [item.orgId, item.id] as const),
  );

  const canStartNewApplication = lendingStatus?.canStartNewApplication !== false;

  return (
    <div className="space-y-6">
      <PageHeader
        title="My lenders"
        description="Organisations you are connected with via invite or public listing."
        actions={
          <Button variant="outline" asChild>
            <Link href="/borrower/lenders/browse">Browse more</Link>
          </Button>
        }
      />

      <BorrowerLendingStatusBanner />

      {error && (
        <div className="space-y-2">
          <p className="text-sm text-destructive">{error}</p>
          <Button size="sm" variant="outline" onClick={() => void refetch()}>
            Retry
          </Button>
        </div>
      )}

      {loading && (
        <div className="grid gap-4 sm:grid-cols-2">
          <CardSkeleton rows={4} />
          <CardSkeleton rows={4} />
        </div>
      )}

      {!loading && lenders.length === 0 && !error && (
        <EmptyState
          title="No lender connections yet"
          description="Browse public lenders or accept an invite from a lender who wants to work with you."
          actionLabel="Browse lenders"
          actionHref="/borrower/lenders/browse"
        />
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {lenders.map((lender) => (
          <div key={lender.id} className="rounded-lg border bg-background p-4 space-y-3">
            <div className="flex gap-3">
              <LenderAvatar name={lender.name} logoUrl={lender.logoUrl} />
              <div className="min-w-0 flex-1 space-y-2">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <h2 className="font-semibold">{lender.name}</h2>
                  <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium">
                    {lender.profile.categoryLabel}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">
                  {lender.isPublic ? 'Public listing' : 'Private connection'} ·{' '}
                  {lender.profile.verificationLabel}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {draftByOrgId.get(lender.id) ? (
                <Button size="sm" asChild>
                  <Link href={`/borrower/applications/${draftByOrgId.get(lender.id)}`}>
                    Continue draft application
                  </Link>
                </Button>
              ) : canStartNewApplication ? (
                <Button size="sm" asChild>
                  <Link
                    href={`/borrower/applications/new?orgId=${lender.id}&lenderName=${encodeURIComponent(lender.name)}`}
                  >
                    Apply for loan
                  </Link>
                </Button>
              ) : (
                <p className="text-sm text-muted-foreground">
                  {lendingStatus?.message ??
                    'Finish your current loan or open application before applying again.'}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
