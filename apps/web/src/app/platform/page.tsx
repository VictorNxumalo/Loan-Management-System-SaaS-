'use client';

import type { PlatformSupportOverviewDto } from '@lms/types';
import Link from 'next/link';
import { PageHeader } from '@/components/page-header';
import { OverviewTile, OverviewTileGrid } from '@/components/overview/overview-tile';
import { useAuthenticatedQuery } from '@/lib/use-authenticated-query';

export default function PlatformOverviewPage() {
  const { data, loading, error } = useAuthenticatedQuery<PlatformSupportOverviewDto>(
    '/platform/support/overview',
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Platform overview"
        description="Monitor lender organisations and user-reported issues across LMS."
      />

      {error && <p className="text-sm text-destructive">{error}</p>}

      <OverviewTileGrid>
        <OverviewTile
          label="Open issues"
          value={loading ? '…' : String(data?.openTickets ?? 0)}
          href="/platform/support"
        />
        <OverviewTile
          label="In progress"
          value={loading ? '…' : String(data?.inProgressTickets ?? 0)}
          href="/platform/support"
        />
        <OverviewTile
          label="Waiting on users"
          value={loading ? '…' : String(data?.waitingOnUserTickets ?? 0)}
          href="/platform/support"
        />
        <OverviewTile
          label="Lender organisations"
          value={loading ? '…' : String(data?.totalLenders ?? 0)}
          href="/platform/compliance"
        />
      </OverviewTileGrid>

      <div className="grid gap-4 sm:grid-cols-2">
        <Link
          href="/platform/support"
          className="rounded-xl border bg-card p-5 shadow-sm transition hover:border-brand-green/40"
        >
          <h2 className="font-semibold">User issues & disputes</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Review complaints and support requests from lenders and borrowers.
          </p>
        </Link>
        <Link
          href="/platform/compliance"
          className="rounded-xl border bg-card p-5 shadow-sm transition hover:border-brand-green/40"
        >
          <h2 className="font-semibold">Lender compliance</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Verify NCR registration and trust badges shown to borrowers.
          </p>
        </Link>
      </div>
    </div>
  );
}
