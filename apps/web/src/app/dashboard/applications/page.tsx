'use client';

import type { LoanApplicationListItemDto, PaginatedLoanApplicationsDto } from '@lms/types';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { ApplicationStatusBadge } from '@/components/application-status-badge';
import { TableSkeleton } from '@/components/brand/skeleton';
import { EmptyState } from '@/components/empty-state';
import { Button } from '@/components/ui/button';
import { useAuthenticatedQuery } from '@/lib/use-authenticated-query';
import { canManageRecords } from '@/lib/permissions';
import { useSession } from 'next-auth/react';

export default function LenderApplicationsPage() {
  const { data: session } = useSession();
  const canReview = canManageRecords(session?.user?.role ?? undefined);
  const [statusFilter, setStatusFilter] = useState('SUBMITTED');

  const path = useMemo(() => {
    const query = statusFilter ? `?status=${statusFilter}&limit=50` : '?limit=50';
    return `/applications${query}`;
  }, [statusFilter]);

  const { data, error, loading } = useAuthenticatedQuery<PaginatedLoanApplicationsDto>(path);
  const applications = data?.items ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Loan applications</h1>
        <p className="text-muted-foreground">
          Review requests from borrowers connected to your organisation.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {['SUBMITTED', 'APPROVED', 'REJECTED', 'WITHDRAWN', ''].map((value) => (
          <Button
            key={value || 'all'}
            size="sm"
            variant={statusFilter === value ? 'default' : 'outline'}
            onClick={() => setStatusFilter(value)}
          >
            {value ? value.charAt(0) + value.slice(1).toLowerCase() : 'All'}
          </Button>
        ))}
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
      {loading && <TableSkeleton rows={6} />}

      {!canReview && (
        <p className="text-sm text-muted-foreground">
          You have read-only access. Contact an admin or loan officer to review applications.
        </p>
      )}

      {!loading && applications.length === 0 && !error && (
        <EmptyState
          title="No applications in this view"
          description="When a connected borrower submits a loan request, it will appear here for review."
        />
      )}

      <div className="space-y-3">
        {applications.map((application: LoanApplicationListItemDto) => (
          <Link
            key={application.id}
            href={`/dashboard/applications/${application.id}`}
            className="block rounded-lg border bg-background p-4 transition hover:border-primary/40"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="font-semibold">{application.borrowerName}</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {application.principalFormatted} · {application.termPeriods}{' '}
                  {application.frequency.toLowerCase().replace('_', '-')} payments
                </p>
                {application.purpose && (
                  <p className="mt-2 text-sm line-clamp-2">{application.purpose}</p>
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
