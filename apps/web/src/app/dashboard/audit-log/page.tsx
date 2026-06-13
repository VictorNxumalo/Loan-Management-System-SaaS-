'use client';

import { useSession } from 'next-auth/react';
import { useCallback, useEffect, useState } from 'react';
import type { PaginatedAuditLogsDto } from '@lms/types';
import { TableSkeleton } from '@/components/brand/skeleton';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { canManageSettings } from '@/lib/permissions';
import { useApi } from '@/lib/use-api';

const ACTION_LABELS: Record<string, string> = {
  'borrower.created': 'Borrower created',
  'borrower.updated': 'Borrower updated',
  'borrower.deleted': 'Borrower deleted',
  'loan.created': 'Loan created',
  'loan.updated': 'Loan updated',
  'loan.activated': 'Loan activated',
  'repayment.recorded': 'Repayment recorded',
  'document.uploaded': 'Document uploaded',
  'document.deleted': 'Document deleted',
  'application.approved': 'Application approved',
  'application.rejected': 'Application rejected',
  'settings.updated': 'Settings updated',
  'team.invite_sent': 'Team invite sent',
  'team.invite_revoked': 'Team invite revoked',
  'team.member_removed': 'Team member removed',
  'team.member_joined': 'Team member joined',
};

function describeState(state: unknown): string | null {
  if (!state || typeof state !== 'object') {
    return null;
  }
  const entries = Object.entries(state as Record<string, unknown>)
    .filter(([, value]) => value !== null && typeof value !== 'object')
    .slice(0, 4)
    .map(([key, value]) => `${key}: ${String(value)}`);
  return entries.length > 0 ? entries.join(' · ') : null;
}

export default function AuditLogPage() {
  const api = useApi();
  const { data: session } = useSession();
  const isAdmin = canManageSettings(session?.user?.role ?? undefined);

  const [data, setData] = useState<PaginatedAuditLogsDto | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadPage = useCallback(
    async (pageNumber: number) => {
      setLoading(true);
      setError(null);
      try {
        const result = await api<PaginatedAuditLogsDto>(
          `/audit-logs?page=${pageNumber}&limit=25`,
        );
        setData(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not load audit log');
      } finally {
        setLoading(false);
      }
    },
    [api],
  );

  useEffect(() => {
    if (session?.accessToken && isAdmin) {
      void loadPage(page);
    }
  }, [session?.accessToken, isAdmin, page, loadPage]);

  if (!isAdmin) {
    return (
      <p className="text-sm text-muted-foreground">
        Only admins can view the audit log.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Audit log"
        description="Immutable record of every important change in your workspace."
      />

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Card>
        <CardHeader>
          <CardTitle>Activity</CardTitle>
          <CardDescription>
            {data ? `${data.total} recorded event(s)` : 'Fetching activity…'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <TableSkeleton rows={6} />
          ) : data && data.items.length > 0 ? (
            <div className="divide-y">
              {data.items.map((entry) => {
                const afterSummary = describeState(entry.afterState);
                const beforeSummary = describeState(entry.beforeState);
                return (
                  <div key={entry.id} className="space-y-1 py-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-medium">
                        {ACTION_LABELS[entry.action] ?? entry.action}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(entry.createdAt).toLocaleString()}
                      </p>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      By {entry.userName} ({entry.userEmail}) · {entry.entityType}{' '}
                      {entry.entityId.slice(0, 8)}…
                    </p>
                    {beforeSummary && (
                      <p className="text-xs text-muted-foreground">
                        Before — {beforeSummary}
                      </p>
                    )}
                    {afterSummary && (
                      <p className="text-xs text-muted-foreground">
                        After — {afterSummary}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No activity recorded yet.</p>
          )}

          {data && data.totalPages > 1 && (
            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1 || loading}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Previous
              </Button>
              <p className="text-xs text-muted-foreground">
                Page {data.page} of {data.totalPages}
              </p>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= data.totalPages || loading}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
