'use client';

import type {
  ApproveLoanApplicationResultDto,
  LoanApplicationDetailDto,
} from '@lms/types';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import { ApplicationStatusBadge } from '@/components/application-status-badge';
import { ApplicationReviewChecklistPanel } from '@/components/application-review-checklist';
import { PageLoading } from '@/components/brand/loading';
import { LenderApplicationDocumentsPanel } from '@/components/lender-application-documents-panel';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useApi } from '@/lib/use-api';
import { useAuthenticatedQuery } from '@/lib/use-authenticated-query';
import { canManageRecords } from '@/lib/permissions';
import { useSession } from 'next-auth/react';

export default function LenderApplicationDetailPage() {
  const api = useApi();
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const { data: session } = useSession();
  const canReview = canManageRecords(session?.user?.role ?? undefined);

  const { data: application, error, loading, refetch } =
    useAuthenticatedQuery<LoanApplicationDetailDto>(
      params.id ? `/applications/${params.id}` : null,
    );

  const [annualRate, setAnnualRate] = useState('12');
  const [approveNotes, setApproveNotes] = useState('');
  const [rejectNotes, setRejectNotes] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<'approve' | 'reject' | null>(null);

  const approve = async () => {
    setActionLoading('approve');
    setActionError(null);
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
      await refetch();
      if (result.application) {
        // refetch updates application state via hook
      }
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Could not approve application');
    } finally {
      setActionLoading(null);
    }
  };

  const reject = async () => {
    if (!rejectNotes.trim()) {
      setActionError('Please provide a reason for rejection');
      return;
    }

    setActionLoading('reject');
    setActionError(null);
    try {
      await api<LoanApplicationDetailDto>(`/applications/${params.id}/reject`, {
        method: 'POST',
        body: JSON.stringify({ lenderNotes: rejectNotes.trim() }),
      });
      await refetch();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Could not reject application');
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return <PageLoading label="Loading application…" />;
  }

  if (error || !application) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-destructive">{error ?? 'Application not found'}</p>
        <Link href="/dashboard/applications" className="text-sm text-primary hover:underline">
          Back to applications
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        backHref="/dashboard/applications"
        backLabel="Back to applications"
        title={`Application from ${application.borrowerName}`}
        description={`Submitted ${new Date(application.submittedAt).toLocaleDateString()}`}
        actions={<ApplicationStatusBadge status={application.status} />}
      />

      {actionError && <p className="text-sm text-destructive">{actionError}</p>}

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

        {application.bankDetails && (
          <div className="border-t pt-4">
            <p className="text-sm font-medium">Bank details (borrower provided)</p>
            <dl className="mt-2 grid gap-2 sm:grid-cols-2 text-sm">
              <div>
                <dt className="text-muted-foreground">Account holder</dt>
                <dd>{application.bankDetails.accountHolder}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Bank</dt>
                <dd>{application.bankDetails.bankName}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Branch code</dt>
                <dd>{application.bankDetails.branchCode}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Account number</dt>
                <dd>{application.bankDetails.accountNumber}</dd>
              </div>
            </dl>
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

      <div className="rounded-lg border bg-background p-6 space-y-3">
        <h2 className="font-semibold">Supporting documents</h2>
        <LenderApplicationDocumentsPanel applicationId={application.id} />
      </div>

      {application.status === 'SUBMITTED' && (
        <ApplicationReviewChecklistPanel
          applicationId={application.id}
          checklist={application.reviewChecklist}
          canEdit={canReview}
          onSaved={() => void refetch({ silent: true })}
        />
      )}

      {application.status === 'SUBMITTED' && canReview && (
        <div className="grid gap-6 md:grid-cols-2">
          <div className="rounded-lg border bg-background p-4 space-y-4">
            <h2 className="font-semibold">Approve</h2>
            <p className="text-sm text-muted-foreground">
              Creates a borrower record (if needed) and a draft loan you can review and
              activate.
            </p>
            {!application.reviewChecklist.isComplete && (
              <p className="text-sm text-amber-800">
                Complete and save the review checklist first.
              </p>
            )}
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
              disabled={actionLoading !== null || !application.reviewChecklist.isComplete}
              onClick={() => void approve()}
            >
              {actionLoading === 'approve' ? 'Approving…' : 'Approve application'}
            </Button>
          </div>

          <div className="rounded-lg border bg-background p-4 space-y-4">
            <h2 className="font-semibold">Reject</h2>
            <p className="text-sm text-muted-foreground">
              The borrower will see your reason on their application detail page.
            </p>
            {!application.reviewChecklist.isComplete && (
              <p className="text-sm text-amber-800">
                Complete and save the review checklist first.
              </p>
            )}
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
              disabled={actionLoading !== null || !application.reviewChecklist.isComplete}
              onClick={() => void reject()}
            >
              {actionLoading === 'reject' ? 'Rejecting…' : 'Reject application'}
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
