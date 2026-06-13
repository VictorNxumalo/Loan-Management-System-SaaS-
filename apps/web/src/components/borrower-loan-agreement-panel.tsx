'use client';

import type { LoanAgreementSummaryDto } from '@lms/types';
import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { getApiBaseUrl } from '@/lib/api-url';
import { openLoanAgreementHtml } from '@/lib/open-loan-agreement';
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
  const { data: session } = useSession();
  const [signing, setSigning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [acknowledged, setAcknowledged] = useState(false);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);

  useEffect(() => {
    if (!session?.accessToken || !agreement.canSign) {
      setPreviewHtml(null);
      return;
    }

    let cancelled = false;
    setLoadingPreview(true);

    void (async () => {
      try {
        const response = await fetch(
          `${getApiBaseUrl()}/borrower/loans/${loanId}/loan-agreement/html`,
          {
            headers: {
              Authorization: `Bearer ${session.accessToken}`,
              Accept: 'text/html',
            },
          },
        );

        if (!response.ok) {
          throw new Error('Could not load agreement');
        }

        const html = await response.text();
        if (!cancelled) {
          setPreviewHtml(html);
        }
      } catch {
        if (!cancelled) {
          setPreviewHtml(null);
        }
      } finally {
        if (!cancelled) {
          setLoadingPreview(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [session?.accessToken, agreement.canSign, loanId]);

  if (agreement.status === 'SIGNED') {
    return (
      <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-900">
        <p className="font-medium">Loan agreement signed</p>
        <p className="mt-1">
          You signed this agreement with {organisationName}
          {agreement.signedAt ? ` on ${agreement.signedAt.slice(0, 10)}` : ''}. The lender will
          disburse funds once they complete that step.
        </p>
        {session?.accessToken ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-3"
            onClick={() =>
              void openLoanAgreementHtml(
                `/borrower/loans/${loanId}/loan-agreement/html`,
                session.accessToken!,
              )
            }
          >
            View signed agreement
          </Button>
        ) : null}
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

      {loadingPreview ? (
        <p className="text-sm text-muted-foreground">Loading agreement…</p>
      ) : previewHtml ? (
        <iframe
          title="Loan agreement preview"
          srcDoc={previewHtml}
          className="h-80 w-full rounded-md border bg-white"
          sandbox=""
        />
      ) : (
        <p className="text-sm text-muted-foreground">Agreement preview unavailable.</p>
      )}

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

      <Button
        type="button"
        disabled={!acknowledged || signing}
        onClick={() => void sign()}
      >
        {signing ? 'Signing…' : 'Sign agreement'}
      </Button>
    </div>
  );
}
