'use client';

import type { LoanApplicationListItemDto, PaginatedLoanApplicationsDto } from '@lms/types';
import Link from 'next/link';
import { ApplicationStatusBadge } from '@/components/application-status-badge';
import { EmptyState } from '@/components/empty-state';
import { Button } from '@/components/ui/button';
import { useAuthenticatedQuery } from '@/lib/use-authenticated-query';

export default function BorrowerApplicationsPage() {
  const { data, error, loading } = useAuthenticatedQuery<PaginatedLoanApplicationsDto>(
    '/borrower/applications?limit=50',
  );

  const applications = data?.items ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">My applications</h1>
          <p className="text-muted-foreground">
            Track loan requests you have submitted to connected lenders.
          </p>
        </div>
        <Button asChild>
          <Link href="/borrower/lenders/mine">Apply to a lender</Link>
        </Button>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
      {loading && <p className="text-sm text-muted-foreground">Loading applications…</p>}

      {!loading && applications.length === 0 && !error && (
        <EmptyState
          title="No applications yet"
          description="Connect with a lender under My lenders, then submit a loan application."
          actionLabel="Go to my lenders"
          actionHref="/borrower/lenders/mine"
        />
      )}

      <div className="space-y-3">
        {applications.map((application: LoanApplicationListItemDto) => (
          <Link
            key={application.id}
            href={`/borrower/applications/${application.id}`}
            className="block rounded-lg border bg-background p-4 transition hover:border-primary/40"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="font-semibold">{application.organisationName}</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {application.principalFormatted} · {application.termPeriods}{' '}
                  {application.frequency.toLowerCase().replace('_', '-')} payments
                </p>
                {application.purpose && (
                  <p className="mt-2 text-sm">{application.purpose}</p>
                )}
              </div>
              <ApplicationStatusBadge status={application.status} />
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
