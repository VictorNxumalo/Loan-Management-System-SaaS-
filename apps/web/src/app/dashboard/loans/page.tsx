'use client';

import type { PaginatedLoansDto } from '@lms/types';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { useEffect, useMemo, useState } from 'react';
import { EmptyState } from '@/components/empty-state';
import {
  LoanPortfolioCard,
  LoanPortfolioSummaryCards,
} from '@/components/loan-portfolio-card';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { canManageRecords } from '@/lib/permissions';
import { useApi } from '@/lib/use-api';

type SortOption = 'newest' | 'oldest' | 'outstanding' | 'borrower';

export default function LoansPage() {
  const api = useApi();
  const { data: session } = useSession();
  const canManage = canManageRecords(session?.user?.role ?? undefined);
  const [data, setData] = useState<PaginatedLoansDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sort, setSort] = useState<SortOption>('newest');

  useEffect(() => {
    void api<PaginatedLoansDto>('/loans?page=1&limit=50')
      .then(setData)
      .catch((err: Error) => setError(err.message));
  }, [api]);

  const sortedItems = useMemo(() => {
    if (!data?.items) {
      return [];
    }

    const items = [...data.items];
    switch (sort) {
      case 'oldest':
        return items.sort(
          (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
        );
      case 'outstanding':
        return items.sort(
          (a, b) => b.outstandingBalanceCents - a.outstandingBalanceCents,
        );
      case 'borrower':
        return items.sort((a, b) => a.borrowerName.localeCompare(b.borrowerName));
      case 'newest':
      default:
        return items.sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        );
    }
  }, [data?.items, sort]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="My loan portfolio"
        description="Track all your lending arrangements and returns"
        actions={
          canManage ? (
            <Button asChild>
              <Link href="/dashboard/loans/new">New loan</Link>
            </Button>
          ) : undefined
        }
      />

      {error && <p className="text-sm text-destructive">{error}</p>}

      {data?.summary ? <LoanPortfolioSummaryCards summary={data.summary} /> : null}

      {data?.items.length ? (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">{data.total} loan{data.total === 1 ? '' : 's'}</p>
          <label className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Sort</span>
            <select
              className="rounded-md border bg-background px-3 py-2"
              value={sort}
              onChange={(e) => setSort(e.target.value as SortOption)}
            >
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
              <option value="outstanding">Highest outstanding</option>
              <option value="borrower">Borrower name</option>
            </select>
          </label>
        </div>
      ) : null}

      {data?.items.length === 0 && !error && (
        <EmptyState
          title="No loans yet"
          description="Create a loan after adding a borrower to generate a schedule and track repayments."
          actionLabel={canManage ? 'Create your first loan' : undefined}
          actionHref={canManage ? '/dashboard/loans/new' : undefined}
        />
      )}

      <div className="grid gap-4">
        {sortedItems.map((loan) => (
          <LoanPortfolioCard key={loan.id} loan={loan} />
        ))}
      </div>
    </div>
  );
}
