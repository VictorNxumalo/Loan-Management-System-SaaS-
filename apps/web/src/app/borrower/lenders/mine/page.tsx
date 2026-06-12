'use client';

import type { MarketplaceLenderDto } from '@lms/types';
import Link from 'next/link';
import { BorrowerLendingStatusBanner } from '@/components/borrower-lending-status-banner';
import { EmptyState } from '@/components/empty-state';
import { Button } from '@/components/ui/button';
import { useAuthenticatedQuery } from '@/lib/use-authenticated-query';

export default function MyLendersPage() {
  const { data, error, loading, refetch } = useAuthenticatedQuery<MarketplaceLenderDto[]>(
    '/borrower/lenders',
  );
  const { data: lendingStatus } = useAuthenticatedQuery<{
    canApplyWithOtherLenders: boolean;
    committedOrgId: string | null;
  }>('/borrower/lending-status');

  const lenders = data ?? [];

  const canApplyWith = (lender: MarketplaceLenderDto) => {
    if (lendingStatus?.canApplyWithOtherLenders === false) {
      return lender.id === lendingStatus.committedOrgId;
    }
    return true;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">My lenders</h1>
          <p className="text-muted-foreground">
            Organisations you are connected with via invite or public listing.
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link href="/borrower/lenders/browse">Browse more</Link>
        </Button>
      </div>

      <BorrowerLendingStatusBanner />

      {error && (
        <div className="space-y-2">
          <p className="text-sm text-destructive">{error}</p>
          <Button size="sm" variant="outline" onClick={() => void refetch()}>
            Retry
          </Button>
        </div>
      )}

      {loading && <p className="text-sm text-muted-foreground">Loading your lenders…</p>}

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
            <div className="flex flex-wrap gap-2">
              {canApplyWith(lender) ? (
                <Button size="sm" asChild>
                  <Link
                    href={`/borrower/applications/new?orgId=${lender.id}&lenderName=${encodeURIComponent(lender.name)}`}
                  >
                    Apply for loan
                  </Link>
                </Button>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Finish your current loan before applying elsewhere.
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
