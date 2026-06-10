'use client';

import type {
  ApproveLoanApplicationResultDto,
  LoanApplicationDetailDto,
} from '@lms/types';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ApplicationStatusBadge } from '@/components/application-status-badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useApi } from '@/lib/use-api';
import { canManageRecords } from '@/lib/permissions';
import { useSession } from 'next-auth/react';

export default function LenderApplicationDetailPage() {
  const api = useApi();
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const { data: session } = useSession();
  const canReview = canManageRecords(session?.user?.role ?? undefined);

  const [application, setApplication] = useState<LoanApplicationDetailDto | null>(null);
  const [annualRate, setAnnualRate] = useState('12');
  const [approveNotes, setApproveNotes] = useState('');
  const [rejectNotes, setRejectNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<'approve' | 'reject' | null>(null);

  useEffect(() => {
    void api<LoanApplicationDetailDto>(`/applications/${params.id}`)
      .then(setApplication)
      .catch((err: Error) => setError(err.message));
  }, [api, params.id]);

  const approve = async () => {
    setLoading('approve');
    setError(null);
    try {
      const result = await api<ApproveLoanApplicationResultDto>(
        `/applications/${params.id}/approve`,
        {
          method: 'POST',
          body: JSON.stringify({
            annualRate: Number(annualRate),
            lenderNotes: approveNotes.trim() || undefined,
          }),
        },
      );
      setApplication(result.application);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not approve application');
    } finally {
      setLoading(null);
    }
  };

  const reject = async () => {
    if (!rejectNotes.trim()) {
      setError('Please provide a reason for rejection');
      return;
    }

    setLoading('reject');
    setError(null);
    try {
      const updated = await api<LoanApplicationDetailDto>(
        `/applications/${params.id}/reject`,
        {
          method: 'POST',
          body: JSON.stringify({ lenderNotes: rejectNotes.trim() }),
        },
      );
      setApplication(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not reject application');
    } finally {
      setLoading(null);
    }
  };

  if (!application && !error) {
    return <p className="text-muted-foreground">Loading application…</p>;
  }

  if (!application) {
    return <p className="text-sm text-destructive">{error}</p>;
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Button variant="ghost" size="sm" asChild>
          <Link href="/dashboard/applications">← Back to applications</Link>
        </Button>
        <div className="mt-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              Application from {application.borrowerName}
            </h1>
            <p className="mt-1 text-muted-foreground">
              Submitted {new Date(application.submittedAt).toLocaleDateString()}
            </p>
          </div>
          <ApplicationStatusBadge status={application.status} />
        </div>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="rounded-lg border bg-background p-6 space-y-4">
        <dl className="grid gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-sm text-muted-foreground">Amount requested</dt>
            <dd className="font-medium">{application.principalFormatted}</dd>
          </div>
          <div>
            <dt className="text-sm text-muted-foreground">Start date</dt>
            <dd className="font-medium">{application.startDate}</dd>
          </div>
          <div>
            <dt className="text-sm text-muted-foreground">Term</dt>
            <dd className="font-medium">{application.termPeriods} periods</dd>
          </div>
          <div>
            <dt className="text-sm text-muted-foreground">Frequency</dt>
            <dd className="font-medium">{application.frequency.replace('_', ' ')}</dd>
          </div>
          <div>
            <dt className="text-sm text-muted-foreground">Interest method</dt>
            <dd className="font-medium">{application.interestType.replace('_', ' ')}</dd>
          </div>
        </dl>

        {application.purpose && (
          <div>
            <p className="text-sm text-muted-foreground">Purpose</p>
            <p className="mt-1">{application.purpose}</p>
          </div>
        )}

        {application.lenderNotes && (
          <div>
            <p className="text-sm text-muted-foreground">Your notes</p>
            <p className="mt-1">{application.lenderNotes}</p>
          </div>
        )}

        {application.status === 'APPROVED' && application.loanId && (
          <div className="flex flex-wrap gap-3">
            <Button asChild>
              <Link href={`/dashboard/loans/${application.loanId}`}>Open draft loan</Link>
            </Button>
            {application.borrowerId && (
              <Button variant="outline" asChild>
                <Link href={`/dashboard/borrowers/${application.borrowerId}`}>
                  View borrower record
                </Link>
              </Button>
            )}
          </div>
        )}
      </div>

      {application.status === 'SUBMITTED' && canReview && (
        <div className="grid gap-6 md:grid-cols-2">
          <div className="rounded-lg border bg-background p-4 space-y-4">
            <h2 className="font-semibold">Approve</h2>
            <p className="text-sm text-muted-foreground">
              Creates a borrower record (if needed) and a draft loan you can review and
              activate.
            </p>
            <div className="space-y-2">
              <Label htmlFor="annualRate">Annual interest rate (%)</Label>
              <Input
                id="annualRate"
                type="number"
                min={0}
                step="0.01"
                value={annualRate}
                onChange={(e) => setAnnualRate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="approveNotes">Notes (optional)</Label>
              <Input
                id="approveNotes"
                value={approveNotes}
                onChange={(e) => setApproveNotes(e.target.value)}
              />
            </div>
            <Button
              disabled={loading !== null}
              onClick={() => void approve()}
            >
              {loading === 'approve' ? 'Approving…' : 'Approve application'}
            </Button>
          </div>

          <div className="rounded-lg border bg-background p-4 space-y-4">
            <h2 className="font-semibold">Reject</h2>
            <p className="text-sm text-muted-foreground">
              The borrower will see your reason on their application detail page.
            </p>
            <div className="space-y-2">
              <Label htmlFor="rejectNotes">Reason for rejection</Label>
              <Input
                id="rejectNotes"
                value={rejectNotes}
                onChange={(e) => setRejectNotes(e.target.value)}
              />
            </div>
            <Button
              variant="destructive"
              disabled={loading !== null}
              onClick={() => void reject()}
            >
              {loading === 'reject' ? 'Rejecting…' : 'Reject application'}
            </Button>
          </div>
        </div>
      )}

      {application.status === 'SUBMITTED' && !canReview && (
        <p className="text-sm text-muted-foreground">
          Viewers cannot approve or reject applications.
        </p>
      )}

      {application.status !== 'SUBMITTED' && (
        <Button variant="outline" onClick={() => router.push('/dashboard/applications')}>
          Back to list
        </Button>
      )}
    </div>
  );
}
