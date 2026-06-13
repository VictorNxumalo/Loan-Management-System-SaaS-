'use client';

import type { PaginatedLoansDto } from '@lms/types';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';
import { EmptyState } from '@/components/empty-state';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { canManageRecords } from '@/lib/permissions';
import { useApi } from '@/lib/use-api';

export default function LoansPage() {
  const api = useApi();
  const { data: session } = useSession();
  const canManage = canManageRecords(session?.user?.role ?? undefined);
  const [data, setData] = useState<PaginatedLoansDto | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void api<PaginatedLoansDto>('/loans?page=1&limit=20')
      .then(setData)
      .catch((err: Error) => setError(err.message));
  }, [api]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Loans"
        description="Track lending arrangements and repayments"
        actions={
          canManage ? (
            <Button asChild>
              <Link href="/dashboard/loans/new">New loan</Link>
            </Button>
          ) : undefined
        }
      />

      {error && <p className="text-sm text-destructive">{error}</p>}

      {data?.items.length === 0 && !error && (
        <EmptyState
          title="No loans yet"
          description="Create a loan after adding a borrower to generate a schedule and record repayments."
          actionLabel={canManage ? 'Create your first loan' : undefined}
          actionHref={canManage ? '/dashboard/loans/new' : undefined}
        />
      )}

      {!!data?.items.length && (
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-muted/50 text-left">
              <tr>
                <th className="px-3 py-2">Borrower</th>
                <th className="px-3 py-2">Principal</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Outstanding</th>
                <th className="px-3 py-2">Start date</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((loan) => (
                <tr key={loan.id} className="border-t">
                  <td className="px-3 py-2">{loan.borrowerName}</td>
                  <td className="px-3 py-2">
                    <Link
                      href={`/dashboard/loans/${loan.id}`}
                      className="font-medium text-primary hover:underline"
                    >
                      {loan.principalFormatted}
                    </Link>
                  </td>
                  <td className="px-3 py-2">{loan.status}</td>
                  <td className="px-3 py-2">{loan.outstandingBalanceFormatted}</td>
                  <td className="px-3 py-2">{loan.startDate}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
