'use client';

import type { PlatformLenderComplianceDto } from '@lms/types';
import {
  LENDER_VERIFICATION_STATUS_LABELS,
} from '@lms/types';
import { useSession } from 'next-auth/react';
import { useState } from 'react';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useApi } from '@/lib/use-api';
import { useAuthenticatedQuery } from '@/lib/use-authenticated-query';

export default function PlatformCompliancePage() {
  const { data: session } = useSession();
  const api = useApi();
  const isPlatformAdmin = session?.user?.isPlatformAdmin === true;

  const { data, error, loading, refetch } = useAuthenticatedQuery<
    PlatformLenderComplianceDto[]
  >(isPlatformAdmin ? '/platform/compliance/lenders' : null);

  const [savingOrgId, setSavingOrgId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<
    Record<string, { status: string; notes: string }>
  >({});

  if (!isPlatformAdmin) {
    return (
      <div className="space-y-4">
        <PageHeader
          title="Platform compliance"
          description="LMS operator tools for lender trust and regulatory review."
        />
        <p className="text-sm text-muted-foreground">
          Your account is not configured as a platform operator. Set{' '}
          <code className="text-xs">PLATFORM_ADMIN_EMAILS</code> on the API to include
          your login email.
        </p>
      </div>
    );
  }

  const getDraft = (lender: PlatformLenderComplianceDto) =>
    drafts[lender.orgId] ?? {
      status: lender.verificationStatus,
      notes: lender.verificationNotes ?? '',
    };

  const saveReview = async (lender: PlatformLenderComplianceDto) => {
    const draft = getDraft(lender);
    setSavingOrgId(lender.orgId);
    setActionError(null);
    setMessage(null);

    try {
      await api(`/platform/compliance/lenders/${lender.orgId}/verification`, {
        method: 'PATCH',
        body: JSON.stringify({
          verificationStatus: draft.status,
          verificationNotes: draft.notes.trim() || undefined,
        }),
      });
      setMessage(`Updated verification for ${lender.organisationName}.`);
      await refetch({ silent: true });
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Could not save review');
    } finally {
      setSavingOrgId(null);
    }
  };

  const lenders = data ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Platform compliance"
        description="Review lender NCR details and set verification badges shown to borrowers."
      />

      {error && <p className="text-sm text-destructive">{error}</p>}
      {actionError && <p className="text-sm text-destructive">{actionError}</p>}
      {message && <p className="text-sm text-green-700">{message}</p>}

      {loading && <p className="text-sm text-muted-foreground">Loading lenders…</p>}

      <div className="space-y-4">
        {lenders.map((lender) => {
          const draft = getDraft(lender);
          return (
            <Card key={lender.orgId}>
              <CardHeader>
                <CardTitle className="text-lg">{lender.organisationName}</CardTitle>
                <CardDescription>
                  {lender.isPublic ? 'Publicly listed' : 'Not public'} · Current:{' '}
                  {lender.verificationLabel}
                  {lender.verificationReviewedAt
                    ? ` · Reviewed ${new Date(lender.verificationReviewedAt).toLocaleDateString()}`
                    : ''}
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2">
                <dl className="space-y-2 text-sm md:col-span-2">
                  <div className="flex justify-between gap-4">
                    <dt className="text-muted-foreground">Legal entity</dt>
                    <dd>{lender.legalEntityName ?? '—'}</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-muted-foreground">NCR registration</dt>
                    <dd>{lender.ncrRegistrationNumber ?? '—'}</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-muted-foreground">Compliance contact</dt>
                    <dd>{lender.complianceContactEmail ?? '—'}</dd>
                  </div>
                </dl>

                <div className="space-y-2">
                  <Label htmlFor={`status-${lender.orgId}`}>Verification status</Label>
                  <select
                    id={`status-${lender.orgId}`}
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                    value={draft.status}
                    onChange={(event) =>
                      setDrafts((prev) => ({
                        ...prev,
                        [lender.orgId]: { ...draft, status: event.target.value },
                      }))
                    }
                  >
                    {Object.entries(LENDER_VERIFICATION_STATUS_LABELS).map(
                      ([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ),
                    )}
                  </select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor={`notes-${lender.orgId}`}>Internal notes</Label>
                  <Input
                    id={`notes-${lender.orgId}`}
                    value={draft.notes}
                    onChange={(event) =>
                      setDrafts((prev) => ({
                        ...prev,
                        [lender.orgId]: { ...draft, notes: event.target.value },
                      }))
                    }
                    placeholder="e.g. NCR certificate verified 2026-06-16"
                  />
                </div>

                <div className="md:col-span-2">
                  <Button
                    size="sm"
                    disabled={savingOrgId === lender.orgId}
                    onClick={() => void saveReview(lender)}
                  >
                    {savingOrgId === lender.orgId ? 'Saving…' : 'Save verification review'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {!loading && lenders.length === 0 && !error && (
        <p className="text-sm text-muted-foreground">No lender organisations found.</p>
      )}
    </div>
  );
}
