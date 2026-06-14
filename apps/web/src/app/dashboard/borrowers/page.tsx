'use client';

import type { PaginatedBorrowersDto } from '@lms/types';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';
import {
  BorrowerListCard,
  BorrowerPortfolioSummaryCards,
} from '@/components/borrower-list-card';
import { EmptyState } from '@/components/empty-state';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { canManageRecords } from '@/lib/permissions';
import { useApi } from '@/lib/use-api';

export default function BorrowersPage() {
  const api = useApi();
  const { data: session } = useSession();
  const canManage = canManageRecords(session?.user?.role ?? undefined);
  const [q, setQ] = useState('');
  const [data, setData] = useState<PaginatedBorrowersDto | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      void api<PaginatedBorrowersDto>(`/borrowers?q=${encodeURIComponent(q)}&page=1&limit=50`)
        .then(setData)
        .catch((err: Error) => setError(err.message));
    }, 300);

    return () => clearTimeout(timer);
  }, [api, q]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="People I lend to"
        description="Profiles, loan exposure, and repayment status for each borrower"
        actions={
          canManage ? (
            <Button asChild>
              <Link href="/dashboard/borrowers/new">Add borrower</Link>
            </Button>
          ) : undefined
        }
      />

      <Input
        placeholder="Search by name or ID number"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />

      {error && <p className="text-sm text-destructive">{error}</p>}

      {data?.summary ? (
        <BorrowerPortfolioSummaryCards summary={data.summary} totalPeople={data.total} />
      ) : null}

      {data?.items.length === 0 && !error && !q && (
        <EmptyState
          title="No borrowers yet"
          description="Add someone you lend money to so you can create loans and track repayments."
          actionLabel={canManage ? 'Add your first borrower' : undefined}
          actionHref={canManage ? '/dashboard/borrowers/new' : undefined}
        />
      )}

      {(!!data?.items.length || !!q) && data?.items.length === 0 && !error ? (
        <p className="text-sm text-muted-foreground">No borrowers found</p>
      ) : null}

      <div className="grid gap-4">
        {data?.items.map((borrower) => (
          <BorrowerListCard key={borrower.id} borrower={borrower} />
        ))}
      </div>
    </div>
  );
}
