'use client';

import type { MarketplaceLenderDto } from '@lms/types';
import Link from 'next/link';
import { useState } from 'react';
import { EmptyState } from '@/components/empty-state';
import { Button } from '@/components/ui/button';
import { useAuthenticatedQuery } from '@/lib/use-authenticated-query';

export default function BrowseLendersPage() {
  const { data, error, loading, refetch } = useAuthenticatedQuery<MarketplaceLenderDto[]>(
    '/marketplace/lenders/me',
  );
  const [message, setMessage] = useState<string | null>(null);
  const [connectingId, setConnectingId] = useState<string | null>(null);

  const lenders = data ?? [];

  const connect = async (orgId: string) => {
    setMessage(null);
    setConnectingId(orgId);

    try {
      const { apiFetch } = await import('@/lib/api');
      const { getSession } = await import('next-auth/react');
      const session = await getSession();

      const result = await apiFetch<{ message: string }>(
        `/borrower/lenders/${orgId}/connect`,
        {
          method: 'POST',
          accessToken: session?.accessToken,
        },
      );

      setMessage(result.message);
      await refetch();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Could not connect');
    } finally {
      setConnectingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Browse lenders</h1>
        <p className="text-muted-foreground">
          Public lending organisations you can connect with on LMS.
        </p>
      </div>

      {error && (
        <div className="space-y-2">
          <p className="text-sm text-destructive">{error}</p>
          <Button size="sm" variant="outline" onClick={() => void refetch()}>
            Retry
          </Button>
        </div>
      )}
      {message && <p className="text-sm text-green-700">{message}</p>}

      {loading && <p className="text-sm text-muted-foreground">Loading lenders…</p>}

      {!loading && lenders.length === 0 && !error && (
        <EmptyState
          title="No public lenders yet"
          description="Lending organisations appear here when they are listed publicly. Ask your lender to check Settings → Public lender directory."
        />
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {lenders.map((lender) => (
          <div key={lender.id} className="rounded-lg border bg-background p-4">
            <h2 className="font-semibold">{lender.name}</h2>
            <p className="mt-1 text-sm text-muted-foreground">Plan: {lender.plan}</p>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              {lender.isConnected ? (
                <>
                  <p className="text-sm font-medium text-green-700">Connected</p>
                  <Button size="sm" variant="outline" asChild>
                    <Link href="/borrower/lenders/mine">View in my lenders</Link>
                  </Button>
                </>
              ) : (
                <Button
                  size="sm"
                  disabled={connectingId === lender.id}
                  onClick={() => void connect(lender.id)}
                >
                  {connectingId === lender.id ? 'Connecting…' : 'Connect'}
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
