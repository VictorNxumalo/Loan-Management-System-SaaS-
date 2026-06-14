'use client';

import { useSession } from 'next-auth/react';
import { useCallback, useEffect, useState } from 'react';
import type { AuditLogEntryDto, PaginatedAuditLogsDto } from '@lms/types';
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

export default function AuditLogPage() {
  const api = useApi();
  const { data: session } = useSession();
  const isAdmin = canManageSettings(session?.user?.role ?? undefined);

  const [data, setData] = useState<PaginatedAuditLogsDto | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedEntry, setSelectedEntry] = useState<AuditLogEntryDto | null>(null);

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
        description="Immutable record of important changes in your workspace. Click an event for full details."
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
              {data.items.map((entry) => (
                <button
                  key={entry.id}
                  type="button"
                  onClick={() => setSelectedEntry(entry)}
                  className="w-full space-y-1 py-3 text-left transition-colors hover:bg-muted/40 rounded-md px-2 -mx-2"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-medium">{entry.summary}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(entry.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    By {entry.userName}
                    {entry.subjectLabel ? ` · ${entry.subjectLabel}` : ''}
                  </p>
                </button>
              ))}
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

      {selectedEntry ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center">
          <div className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-xl border bg-background p-6 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold">Audit event details</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {new Date(selectedEntry.createdAt).toLocaleString()}
                </p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setSelectedEntry(null)}>
                Close
              </Button>
            </div>

            <p className="mt-4 text-sm">{selectedEntry.summary}</p>

            <dl className="mt-4 space-y-3 text-sm">
              <div>
                <dt className="text-muted-foreground">Performed by</dt>
                <dd className="font-medium">
                  {selectedEntry.userName} ({selectedEntry.userEmail})
                </dd>
              </div>
              {selectedEntry.details.map((field) => (
                <div key={`${field.label}-${field.value}`}>
                  <dt className="text-muted-foreground">{field.label}</dt>
                  <dd className="font-medium break-all">{field.value}</dd>
                </div>
              ))}
            </dl>

            <div className="mt-6 flex justify-end">
              <Button variant="outline" onClick={() => setSelectedEntry(null)}>
                Done
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
