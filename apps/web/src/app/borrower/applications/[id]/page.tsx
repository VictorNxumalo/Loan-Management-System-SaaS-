'use client';

import { BorrowerLoanAgreementPanel } from '@/components/borrower-loan-agreement-panel';
import type {
  BorrowerLendingStatusDto,
  BorrowerLoanDetailDto,
  LoanApplicationDetailDto,
} from '@lms/types';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { PageLoading } from '@/components/brand/loading';
import { ApplicationDocumentsPanel } from '@/components/application-documents-panel';
import { ApplicationStatusBadge } from '@/components/application-status-badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { useApi } from '@/lib/use-api';
import { useAuthenticatedQuery } from '@/lib/use-authenticated-query';

export default function BorrowerApplicationDetailPage() {
  const api = useApi();
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const [application, setApplication] = useState<LoanApplicationDetailDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { data: lendingStatus } = useAuthenticatedQuery<BorrowerLendingStatusDto>(
    '/borrower/lending-status',
  );
  const { data: linkedLoan, refetch: refetchLoan } = useAuthenticatedQuery<BorrowerLoanDetailDto>(
    application?.loanId ? `/borrower/loans/${application.loanId}` : null,
  );
  const canSubmitDraft = lendingStatus?.canSubmitDraftApplication !== false;

  const load = useCallback(async () => {
    const result = await api<LoanApplicationDetailDto>(
      `/borrower/applications/${params.id}`,
    );
    setApplication(result);
  }, [api, params.id]);

  useEffect(() => {
    void load().catch((err: Error) => setError(err.message));
  }, [load]);

  const withdraw = async () => {
    setLoading(true);
    setError(null);
    try {
      const updated = await api<LoanApplicationDetailDto>(
        `/borrower/applications/${params.id}/withdraw`,
        { method: 'POST' },
      );
      setApplication(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not withdraw application');
    } finally {
      setLoading(false);
    }
  };

  const submit = async () => {
    setLoading(true);
    setError(null);
    try {
      const updated = await api<LoanApplicationDetailDto>(
        `/borrower/applications/${params.id}/submit`,
        { method: 'POST' },
      );
      setApplication(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not submit application');
    } finally {
      setLoading(false);
    }
  };

  if (!application && !error) {
    return <PageLoading label="Loading application…" />;
  }

  if (!application) {
    return <p className="text-sm text-destructive">{error}</p>;
  }

  const isDraft = application.status === 'DRAFT';
  const isOpen = isDraft || application.status === 'SUBMITTED';

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <Button variant="ghost" size="sm" asChild>
          <Link href="/borrower/applications">← Back to applications</Link>
        </Button>
        <div className="mt-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              Application to {application.organisationName}
            </h1>
            <p className="mt-1 text-muted-foreground">
              {isDraft
                ? 'Draft — review and submit when ready'
                : `Submitted ${new Date(application.submittedAt).toLocaleDateString()}`}
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

        {application.bankDetails && (
          <div className="border-t pt-4">
            <p className="text-sm font-medium">Bank details</p>
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
            <p className="text-sm text-muted-foreground">Lender response</p>
            <p className="mt-1">{application.lenderNotes}</p>
          </div>
        )}

        {application.status === 'APPROVED' && application.loanId && (
          <p className="text-sm text-green-700">
            Your application was approved. Review and sign the loan agreement below when the
            lender sends it — funds are disbursed only after you sign.
          </p>
        )}
      </div>

      {application.status === 'APPROVED' &&
        application.loanId &&
        linkedLoan &&
        (linkedLoan.agreement.requiresBorrowerSignature ||
          linkedLoan.agreement.status === 'SIGNED') && (
          <BorrowerLoanAgreementPanel
            loanId={application.loanId}
            organisationName={application.organisationName}
            agreement={linkedLoan.agreement}
            onSigned={() => void refetchLoan({ silent: true })}
          />
        )}

      {application.status === 'APPROVED' && application.loanId && (
        <Button variant="outline" asChild>
          <Link href={`/borrower/loans/${application.loanId}`}>Open loan details</Link>
        </Button>
      )}

      {isDraft && (
        <Card>
          <CardHeader>
            <CardTitle>Supporting documents</CardTitle>
            <CardDescription>
              Your profile SA ID is linked to this application automatically.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ApplicationDocumentsPanel
              applicationId={application.id}
              requirements={application.documents.requirements}
            />
            <Button
              disabled={loading || !application.documents.isComplete || !canSubmitDraft}
              onClick={() => void submit()}
            >
              {loading ? 'Submitting…' : 'Submit application to lender'}
            </Button>
            {!canSubmitDraft && lendingStatus?.message && (
              <p className="text-sm text-amber-700">{lendingStatus.message}</p>
            )}
            {canSubmitDraft && !application.documents.isComplete && (
              <p className="text-sm text-amber-700">
                Upload your SA ID in profile settings before submitting.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {isOpen && (
        <Button variant="outline" disabled={loading} onClick={() => void withdraw()}>
          {loading ? 'Cancelling…' : isDraft ? 'Discard application' : 'Withdraw application'}
        </Button>
      )}

      {application.status === 'APPROVED' && (
        <Button variant="outline" onClick={() => router.push('/borrower/applications')}>
          Done
        </Button>
      )}
    </div>
  );
}
