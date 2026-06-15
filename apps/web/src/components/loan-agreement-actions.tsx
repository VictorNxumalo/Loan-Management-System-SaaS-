'use client';

import type { LoanAgreementSummaryDto, LoanDetailDto } from '@lms/types';
import { FileText, Send } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { openLoanAgreementHtml } from '@/lib/open-loan-agreement';
import { useApi } from '@/lib/use-api';
import { useAuthenticatedQuery } from '@/lib/use-authenticated-query';
import { useSession } from 'next-auth/react';

/** Generates the LMS agreement, activates the loan if needed, and notifies the borrower to sign. */
export function GenerateLoanAgreementButton({
  loanId,
  loanStatus,
  agreement,
  disabled,
  onComplete,
}: {
  loanId: string;
  loanStatus: string;
  agreement: LoanAgreementSummaryDto;
  disabled?: boolean;
  onComplete?: () => void;
}) {
  const api = useApi();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!agreement.canSend) {
    return null;
  }

  const generate = async () => {
    setLoading(true);
    setError(null);
    try {
      if (loanStatus === 'DRAFT') {
        await api<LoanDetailDto>(`/loans/${loanId}/activate`, { method: 'POST' });
      }
      await api(`/loans/${loanId}/loan-agreement/send`, { method: 'POST' });
      onComplete?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not generate agreement');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-2">
      <Button
        type="button"
        disabled={disabled || loading}
        onClick={() => void generate()}
        className="w-full sm:w-auto"
      >
        <Send className="h-4 w-4" aria-hidden="true" />
        {loading ? 'Sending to borrower…' : 'Generate loan agreement'}
      </Button>
      <p className="text-xs text-muted-foreground">
        Creates the NCA-compliant agreement and sends it to the borrower&apos;s account with a
        notification. They must tap <strong>Sign agreement</strong> before you can disburse.
      </p>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}

export function ViewLoanAgreementButton({
  loanId,
  label = 'View agreement',
  borrower = false,
}: {
  loanId: string;
  label?: string;
  borrower?: boolean;
}) {
  const { data: session } = useSession();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const view = async () => {
    if (!session?.accessToken) return;
    setLoading(true);
    setError(null);
    try {
      const path = borrower
        ? `/borrower/loans/${loanId}/loan-agreement/html`
        : `/loans/${loanId}/loan-agreement/html`;
      await openLoanAgreementHtml(path, session.accessToken);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not open agreement');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-2">
      <Button type="button" variant="outline" disabled={loading} onClick={() => void view()}>
        <FileText className="h-4 w-4" aria-hidden="true" />
        {loading ? 'Opening…' : label}
      </Button>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}

export function LoanAgreementStatusBanner({
  agreement,
}: {
  agreement: LoanAgreementSummaryDto;
}) {
  if (agreement.status === 'NOT_SENT') {
    return (
      <p className="text-sm text-amber-800">
        Generate the loan agreement to send it to the borrower. Disbursement stays locked until
        they sign electronically.
      </p>
    );
  }

  if (agreement.status === 'PENDING_SIGNATURE') {
    return (
      <p className="text-sm text-amber-800">
        Agreement sent to the borrower
        {agreement.sentAt ? ` on ${agreement.sentAt.slice(0, 10)}` : ''}. You&apos;ll be notified
        when they sign; disbursement unlocks after that.
      </p>
    );
  }

  if (agreement.status === 'SIGNED') {
    return (
      <p className="text-sm text-green-800">
        Signed by {agreement.signerName ?? 'the borrower'}
        {agreement.signedAt ? ` on ${agreement.signedAt.slice(0, 10)}` : ''}. You can disburse
        funds to their wallet.
      </p>
    );
  }

  return null;
}

export function LenderApplicationAgreementWorkflow({
  loanId,
  onUpdated,
}: {
  loanId: string;
  onUpdated?: () => void;
}) {
  const api = useApi();
  const [disbursing, setDisbursing] = useState(false);
  const [disburseError, setDisburseError] = useState<string | null>(null);

  const { data: loan, loading, error, refetch } = useAuthenticatedQuery<LoanDetailDto>(
    loanId ? `/loans/${loanId}` : null,
  );

  const refresh = () => {
    void refetch({ silent: true });
    onUpdated?.();
  };

  const disburse = async () => {
    setDisbursing(true);
    setDisburseError(null);
    try {
      await api<LoanDetailDto>(`/loans/${loanId}/disburse`, { method: 'POST' });
      refresh();
    } catch (err) {
      setDisburseError(err instanceof Error ? err.message : 'Could not disburse');
    } finally {
      setDisbursing(false);
    }
  };

  if (loading && !loan) {
    return <p className="text-sm text-muted-foreground">Loading loan agreement status…</p>;
  }

  if (error || !loan) {
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
        {error ?? 'Could not load the loan record for this application.'}
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-background p-4 space-y-4">
      <div>
        <h2 className="font-semibold">Loan agreement & disbursement</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Generate the agreement for the borrower to sign, then disburse once you receive
          confirmation.
        </p>
      </div>
      <LoanAgreementStatusBanner agreement={loan.agreement} />
      <div className="flex flex-wrap gap-2">
        <GenerateLoanAgreementButton
          loanId={loanId}
          loanStatus={loan.status}
          agreement={loan.agreement}
          onComplete={refresh}
        />
        {loan.agreement.status !== 'NOT_SENT' ? (
          <ViewLoanAgreementButton loanId={loanId} />
        ) : null}
      </div>
      {loan.agreement.canDisburse ? (
        <div className="space-y-2 border-t pt-4">
          <Button disabled={disbursing} onClick={() => void disburse()}>
            {disbursing ? 'Disbursing…' : 'Disburse funds to borrower wallet'}
          </Button>
          {disburseError ? <p className="text-sm text-destructive">{disburseError}</p> : null}
          <Button variant="outline" size="sm" asChild>
            <Link href={`/dashboard/loans/${loanId}`}>Open full loan record</Link>
          </Button>
        </div>
      ) : null}
    </div>
  );
}
