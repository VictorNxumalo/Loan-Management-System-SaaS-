'use client';

import type { MarketplaceLenderDto } from '@lms/types';
import {
  LENDER_MARKETPLACE_CATEGORY_LABELS,
} from '@lms/types';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { BorrowerLendingStatusBanner } from '@/components/borrower-lending-status-banner';
import { EmptyState } from '@/components/empty-state';
import { Button } from '@/components/ui/button';
import { useAuthenticatedQuery } from '@/lib/use-authenticated-query';

const CATEGORY_OPTIONS = [
  { value: '', label: 'All categories' },
  ...Object.entries(LENDER_MARKETPLACE_CATEGORY_LABELS).map(([value, label]) => ({
    value,
    label,
  })),
];

export default function BrowseLendersPage() {
  const [category, setCategory] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [connectingId, setConnectingId] = useState<string | null>(null);

  const path = useMemo(() => {
    const params = new URLSearchParams();
    if (category) {
      params.set('category', category);
    }
    const query = params.toString();
    return query ? `/marketplace/lenders/me?${query}` : '/marketplace/lenders/me';
  }, [category]);

  const { data, error, loading, refetch } = useAuthenticatedQuery<MarketplaceLenderDto[]>(
    path,
  );
  const { data: lendingStatus } = useAuthenticatedQuery<{
    canConnectToOtherLenders: boolean;
    committedOrgId: string | null;
  }>('/borrower/lending-status');

  const lenders = data ?? [];

  const connect = async (lender: MarketplaceLenderDto) => {
    setMessage(null);
    setConnectingId(lender.id);

    try {
      const { apiFetch } = await import('@/lib/api');
      const { getSession } = await import('next-auth/react');
      const session = await getSession();

      const result = await apiFetch<{ message: string }>(
        `/borrower/lenders/${lender.id}/connect`,
        {
          method: 'POST',
          accessToken: session?.accessToken,
        },
      );

      setMessage(result.message);
      await refetch({ silent: true });
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Could not connect');
    } finally {
      setConnectingId(null);
    }
  };

  const canConnectTo = (lender: MarketplaceLenderDto) => {
    if (lender.isConnected) {
      return true;
    }
    if (lendingStatus?.canConnectToOtherLenders === false) {
      return lender.id === lendingStatus.committedOrgId;
    }
    return true;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Browse lenders</h1>
        <p className="text-muted-foreground">
          Discover lending organisations by category and connect to apply for a loan.
        </p>
      </div>

      <BorrowerLendingStatusBanner />

      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <label htmlFor="category-filter" className="text-sm font-medium">
            Category
          </label>
          <select
            id="category-filter"
            className="flex h-9 rounded-md border border-input bg-transparent px-3 text-sm"
            value={category}
            onChange={(event) => setCategory(event.target.value)}
          >
            {CATEGORY_OPTIONS.map((option) => (
              <option key={option.value || 'all'} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <div className="space-y-2">
          <p className="text-sm text-destructive">{error}</p>
          <Button size="sm" variant="outline" onClick={() => void refetch()}>
            Retry
          </Button>
        </div>
      )}
      {message && (
        <p className={`text-sm ${message.includes('success') ? 'text-green-700' : 'text-destructive'}`}>
          {message}
        </p>
      )}

      {loading && <p className="text-sm text-muted-foreground">Loading lenders…</p>}

      {!loading && lenders.length === 0 && !error && (
        <EmptyState
          title="No lenders in this category"
          description="Try another category, or ask a lender to list publicly in Settings."
        />
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {lenders.map((lender) => (
          <div key={lender.id} className="rounded-lg border bg-background p-4 space-y-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <h2 className="font-semibold">{lender.name}</h2>
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium">
                {lender.profile.categoryLabel}
              </span>
            </div>

            {lender.profile.description && (
              <p className="text-sm text-muted-foreground">{lender.profile.description}</p>
            )}

            <dl className="grid gap-1 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Verification</dt>
                <dd>{lender.profile.verificationLabel}</dd>
              </div>
              {lender.profile.typicalLoanRangeFormatted && (
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">Typical loans</dt>
                  <dd>{lender.profile.typicalLoanRangeFormatted}</dd>
                </div>
              )}
            </dl>

            <div className="flex flex-wrap items-center gap-2 pt-1">
              {lender.isConnected ? (
                <>
                  <p className="text-sm font-medium text-green-700">Connected</p>
                  <Button size="sm" variant="outline" asChild>
                    <Link href="/borrower/lenders/mine">View in my lenders</Link>
                  </Button>
                </>
              ) : canConnectTo(lender) ? (
                <Button
                  size="sm"
                  disabled={connectingId === lender.id}
                  onClick={() => void connect(lender)}
                >
                  {connectingId === lender.id ? 'Connecting…' : 'Connect'}
                </Button>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Finish your current loan before connecting here.
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
