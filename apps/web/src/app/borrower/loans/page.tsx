'use client';

import type { BorrowerLoanListItemDto, PaginatedBorrowerLoansDto } from '@lms/types';
import Link from 'next/link';
import { TableSkeleton } from '@/components/brand/skeleton';
import { EmptyState } from '@/components/empty-state';
import { LoanStatusBadge } from '@/components/loan-status-badge';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { useAuthenticatedQuery } from '@/lib/use-authenticated-query';

export default function BorrowerLoansPage() {
  const { data, error, loading } = useAuthenticatedQuery<PaginatedBorrowerLoansDto>(
    '/borrower/loans?limit=50',
  );

  const loans = data?.items ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="My loans"
        description="View loans from lenders you are connected with."
        actions={
          <Button variant="outline" asChild>
            <Link href="/borrower/applications">View applications</Link>
          </Button>
        }
      />

      {error && <p className="text-sm text-destructive">{error}</p>}
      {loading && <TableSkeleton rows={5} />}

      {!loading && loans.length === 0 && !error && (
        <EmptyState
          title="No loans yet"
          description="Once a lender approves your application and sets up a loan, it will appear here."
          actionLabel="View my applications"
          actionHref="/borrower/applications"
        />
      )}

      <div className="space-y-3">
        {loans.map((loan: BorrowerLoanListItemDto) => (
          <Link
            key={loan.id}
            href={`/borrower/loans/${loan.id}`}
            className="block rounded-lg border bg-background p-4 transition hover:border-primary/40"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="font-semibold">{loan.organisationName}</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {loan.principalFormatted} · Start {loan.startDate}
                </p>
                <p className="mt-1 text-sm">
                  Outstanding: {loan.outstandingBalanceFormatted}
                </p>
              </div>
              <LoanStatusBadge status={loan.status} />
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
