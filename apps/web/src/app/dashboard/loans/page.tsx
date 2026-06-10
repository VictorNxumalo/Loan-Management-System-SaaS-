'use client';

import type { PaginatedLoansDto } from '@lms/types';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useApi } from '@/lib/use-api';

export default function LoansPage() {
  const api = useApi();
  const [data, setData] = useState<PaginatedLoansDto | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void api<PaginatedLoansDto>('/loans?page=1&limit=20')
      .then(setData)
      .catch((err: Error) => setError(err.message));
  }, [api]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Loans</h1>
          <p className="text-muted-foreground">Manage loans and repayments</p>
        </div>
        <Button asChild>
          <Link href="/dashboard/loans/new">New loan</Link>
        </Button>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

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
            {data?.items.map((loan) => (
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
            {data?.items.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-muted-foreground">
                  No loans found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
