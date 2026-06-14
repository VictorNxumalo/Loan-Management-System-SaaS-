'use client';

import type { LoanAgreementSummaryDto } from '@lms/types';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { LoanAgreementViewer } from '@/components/loan-agreement-viewer';
import { useApi } from '@/lib/use-api';

export function BorrowerLoanAgreementPanel({
  loanId,
  organisationName,
  agreement,
  onSigned,
}: {
  loanId: string;
  organisationName: string;
  agreement: LoanAgreementSummaryDto;
  onSigned?: () => void;
}) {
  const api = useApi();
  const [signing, setSigning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [acknowledged, setAcknowledged] = useState(false);

  if (agreement.status === 'NOT_SENT') {
    return null;
  }

  if (agreement.status === 'SIGNED') {
    return (
      <div className="rounded-lg border border-green-200 bg-green-50 p-4 space-y-4 text-sm text-green-900">
        <div>
          <p className="font-medium">Loan agreement signed</p>
          <p className="mt-1">
            You signed this agreement with {organisationName}
            {agreement.signedAt ? ` on ${agreement.signedAt.slice(0, 10)}` : ''}. Review your
            signed copy below to confirm your e-signature details.
          </p>
        </div>
        <LoanAgreementViewer loanId={loanId} borrower label="Open signed agreement in new tab" />
      </div>
    );
  }

  if (!agreement.requiresBorrowerSignature) {
    return null;
  }

  const sign = async () => {
    setSigning(true);
    setError(null);
    try {
      await api(`/borrower/loans/${loanId}/loan-agreement/sign`, {
        method: 'POST',
        body: JSON.stringify({ acknowledged: true }),
      });
      onSigned?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not sign agreement');
    } finally {
      setSigning(false);
    }
  };

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50/80 p-4 space-y-4">
      <div>
        <p className="font-semibold text-brand-navy">Action required — sign your loan agreement</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {organisationName} sent you a loan agreement. Review the terms below, then sign
          electronically using your LMS profile. The lender cannot disburse funds until you sign.
        </p>
      </div>

      <LoanAgreementViewer loanId={loanId} borrower label="Open full agreement in new tab" />

      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          className="mt-1"
          checked={acknowledged}
          onChange={(e) => setAcknowledged(e.target.checked)}
        />
        <span>
          I have read and accept the loan agreement terms, including the NCA interest cap enforced
          by LMS. I authorise electronic signing with my profile details (name, email, and SA ID).
        </span>
      </label>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <Button type="button" disabled={!acknowledged || signing} onClick={() => void sign()}>
        {signing ? 'Signing…' : 'Sign agreement'}
      </Button>
    </div>
  );
}
