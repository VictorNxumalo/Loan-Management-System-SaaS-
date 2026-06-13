'use client';

import type { PaginatedBorrowersDto } from '@lms/types';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';
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
      void api<PaginatedBorrowersDto>(`/borrowers?q=${encodeURIComponent(q)}&page=1&limit=20`)
        .then(setData)
        .catch((err: Error) => setError(err.message));
    }, 300);

    return () => clearTimeout(timer);
  }, [api, q]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="People I lend to"
        description="Profiles for people who receive loans from your organisation"
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

      {data?.items.length === 0 && !error && !q && (
        <EmptyState
          title="No borrowers yet"
          description="Add someone you lend money to so you can create loans and track repayments."
          actionLabel={canManage ? 'Add your first borrower' : undefined}
          actionHref={canManage ? '/dashboard/borrowers/new' : undefined}
        />
      )}

      {(!!data?.items.length || !!q) && (
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-muted/50 text-left">
              <tr>
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">ID number</th>
                <th className="px-3 py-2">Phone</th>
                <th className="px-3 py-2">Email</th>
              </tr>
            </thead>
            <tbody>
              {data?.items.map((borrower) => (
                <tr key={borrower.id} className="border-t">
                  <td className="px-3 py-2">
                    <Link
                      href={`/dashboard/borrowers/${borrower.id}`}
                      className="font-medium text-primary hover:underline"
                    >
                      {borrower.fullName}
                    </Link>
                  </td>
                  <td className="px-3 py-2">{borrower.idNumber}</td>
                  <td className="px-3 py-2">{borrower.phone}</td>
                  <td className="px-3 py-2">{borrower.email ?? '—'}</td>
                </tr>
              ))}
              {data?.items.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-3 py-8 text-center text-muted-foreground">
                    No borrowers found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
