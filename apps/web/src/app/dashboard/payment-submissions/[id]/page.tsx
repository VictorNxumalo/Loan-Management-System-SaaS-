'use client';

import type {
  ConfirmPaymentSubmissionResultDto,
  PaymentSubmissionDetailDto,
} from '@lms/types';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useApi } from '@/lib/use-api';
import { useAuthenticatedQuery } from '@/lib/use-authenticated-query';
import { canManageRecords } from '@/lib/permissions';
import { useSession } from 'next-auth/react';

export default function PaymentSubmissionReviewPage() {
  const api = useApi();
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const { data: session } = useSession();
  const canReview = canManageRecords(session?.user?.role ?? undefined);

  const { data: submission, error, loading, refetch } =
    useAuthenticatedQuery<PaymentSubmissionDetailDto>(
      params.id ? `/payment-submissions/${params.id}` : null,
    );

  const [actionError, setActionError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<'confirm' | 'reject' | null>(null);
  const [rejectNote, setRejectNote] = useState('');

  const downloadProof = async () => {
    setActionError(null);
    try {
      const result = await api<{ downloadUrl: string }>(
        `/payment-submissions/${params.id}/proof/download-url`,
      );
      window.open(result.downloadUrl, '_blank', 'noopener,noreferrer');
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Could not download proof');
    }
  };

  const confirm = async () => {
    setActionLoading('confirm');
    setActionError(null);
    try {
      const result = await api<ConfirmPaymentSubmissionResultDto>(
        `/payment-submissions/${params.id}/confirm`,
        { method: 'POST' },
      );
      await refetch();
      router.push(`/dashboard/loans/${result.submission.loanId}`);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Could not record payment');
    } finally {
      setActionLoading(null);
    }
  };

  const reject = async () => {
    if (!rejectNote.trim()) {
      setActionError('Please provide a reason for rejection');
      return;
    }

    setActionLoading('reject');
    setActionError(null);
    try {
      await api<PaymentSubmissionDetailDto>(`/payment-submissions/${params.id}/reject`, {
        method: 'POST',
        body: JSON.stringify({ reviewNote: rejectNote.trim() }),
      });
      await refetch();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Could not reject payment');
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return <p className="text-muted-foreground">Loading payment…</p>;
  }

  if (error || !submission) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-destructive">{error ?? 'Payment not found'}</p>
        <Link href="/dashboard" className="text-sm text-primary hover:underline">
          Back to dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Button variant="ghost" size="sm" asChild>
          <Link href={`/dashboard/loans/${submission.loanId}`}>← Back to loan</Link>
        </Button>
        <h1 className="mt-4 text-2xl font-bold tracking-tight">Borrower payment review</h1>
        <p className="text-muted-foreground">
          {submission.borrowerName} reported a payment to {submission.organisationName}.
        </p>
      </div>

      {actionError && <p className="text-sm text-destructive">{actionError}</p>}

      <div className="rounded-lg border bg-background p-6 space-y-4">
        <dl className="grid gap-4 sm:grid-cols-2 text-sm">
          <div>
            <dt className="text-muted-foreground">Amount</dt>
            <dd className="font-medium text-lg">{submission.amountFormatted}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Payment date</dt>
            <dd className="font-medium">{submission.paymentDate}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Loan outstanding</dt>
            <dd className="font-medium">{submission.loanOutstandingFormatted}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Status</dt>
            <dd className="font-medium capitalize">{submission.status.toLowerCase()}</dd>
          </div>
        </dl>

        {submission.referenceNote && (
          <div>
            <p className="text-sm text-muted-foreground">Borrower reference</p>
            <p className="mt-1">{submission.referenceNote}</p>
          </div>
        )}

        {submission.reviewNote && (
          <div>
            <p className="text-sm text-muted-foreground">Review note</p>
            <p className="mt-1">{submission.reviewNote}</p>
          </div>
        )}

        {submission.hasProofDocument && (
          <Button variant="outline" onClick={() => void downloadProof()}>
            Download proof of payment
          </Button>
        )}

        {submission.status === 'CONFIRMED' && submission.repaymentId && (
          <p className="text-sm text-green-700">
            Recorded in repayment history.{' '}
            <Link
              href={`/dashboard/loans/${submission.loanId}`}
              className="font-medium underline"
            >
              View loan
            </Link>
          </p>
        )}
      </div>

      {submission.status === 'PENDING' && canReview && (
        <div className="grid gap-6 md:grid-cols-2">
          <div className="rounded-lg border bg-background p-4 space-y-4">
            <h2 className="font-semibold">Record payment</h2>
            <p className="text-sm text-muted-foreground">
              After verifying the proof, record this payment in the loan ledger. Amount, date,
              and reference will be copied automatically.
            </p>
            <Button disabled={actionLoading !== null} onClick={() => void confirm()}>
              {actionLoading === 'confirm' ? 'Recording…' : 'Record payment'}
            </Button>
          </div>

          <div className="rounded-lg border bg-background p-4 space-y-4">
            <h2 className="font-semibold">Reject</h2>
            <p className="text-sm text-muted-foreground">
              If the proof is invalid or amounts do not match, reject so the borrower can
              resubmit.
            </p>
            <div className="space-y-2">
              <Label htmlFor="rejectNote">Reason</Label>
              <Input
                id="rejectNote"
                value={rejectNote}
                onChange={(e) => setRejectNote(e.target.value)}
              />
            </div>
            <Button
              variant="destructive"
              disabled={actionLoading !== null}
              onClick={() => void reject()}
            >
              {actionLoading === 'reject' ? 'Rejecting…' : 'Reject payment'}
            </Button>
          </div>
        </div>
      )}

      {submission.status === 'PENDING' && !canReview && (
        <p className="text-sm text-muted-foreground">
          Viewers cannot record or reject payments.
        </p>
      )}
    </div>
  );
}
