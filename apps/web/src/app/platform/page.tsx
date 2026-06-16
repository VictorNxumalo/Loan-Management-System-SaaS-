'use client';

import type { PlatformSupportOverviewDto } from '@lms/types';
import { AlertCircle, Building2, Clock, Loader2 } from 'lucide-react';
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
          href="/platform/support"
          title="Open issues"
          description="New support tickets awaiting review"
          value={loading ? '…' : String(data?.openTickets ?? 0)}
          icon={AlertCircle}
          variant={!loading && (data?.openTickets ?? 0) > 0 ? 'alert' : 'default'}
        />
        <OverviewTile
          href="/platform/support"
          title="In progress"
          description="Tickets currently being handled"
          value={loading ? '…' : String(data?.inProgressTickets ?? 0)}
          icon={Loader2}
        />
        <OverviewTile
          href="/platform/support"
          title="Waiting on users"
          description="Awaiting reporter follow-up"
          value={loading ? '…' : String(data?.waitingOnUserTickets ?? 0)}
          icon={Clock}
        />
        <OverviewTile
          href="/platform/compliance"
          title="Lender organisations"
          description="Registered lender workspaces on LMS"
          value={loading ? '…' : String(data?.totalLenders ?? 0)}
          icon={Building2}
          variant="muted"
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
