'use client';

import {
  DEFAULT_NCR_REPO_RATE_PERCENT,
  formatNcaRateCapMessage,
  getNcaMaxAnnualRatePercent,
  isAnnualRateWithinNcaCap,
} from '@lms/utils';
import { FileText } from 'lucide-react';
import { useSession } from 'next-auth/react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { openLoanAgreementHtml } from '@/lib/open-loan-agreement';

const MAX_RATE = getNcaMaxAnnualRatePercent(DEFAULT_NCR_REPO_RATE_PERCENT);
const NCA_HINT = formatNcaRateCapMessage(DEFAULT_NCR_REPO_RATE_PERCENT);

export function NcaRateHint({ annualRate }: { annualRate: number }) {
  const valid = isAnnualRateWithinNcaCap(annualRate);
  return (
    <p className={`text-xs ${valid ? 'text-muted-foreground' : 'text-destructive'}`}>
      {valid
        ? NCA_HINT
        : `Rate exceeds the NCA maximum of ${MAX_RATE}%. Approval will be blocked.`}
    </p>
  );
}

export function GenerateLoanAgreementButton({
  agreementPath,
  disabled,
  label = 'Generate loan agreement',
}: {
  agreementPath: string;
  disabled?: boolean;
  label?: string;
}) {
  const { data: session } = useSession();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = async () => {
    if (!session?.accessToken) return;
    setLoading(true);
    setError(null);
    try {
      await openLoanAgreementHtml(agreementPath, session.accessToken);
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
        variant="outline"
        disabled={disabled || loading || !session?.accessToken}
        onClick={() => void generate()}
        className="w-full sm:w-auto"
      >
        <FileText className="h-4 w-4" aria-hidden="true" />
        {loading ? 'Generating…' : label}
      </Button>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}

export function LoanAgreementNcaNotice() {
  return (
    <div className="rounded-lg border border-brand-green/25 bg-brand-green/5 p-3 text-sm text-muted-foreground">
      <p className="font-medium text-brand-navy">NCA-compliant loan agreement</p>
      <p className="mt-1">
        LMS generates the agreement from our template. The platform enforces National Credit Act
        interest caps — lenders cannot approve rates above the legal maximum ({MAX_RATE}% at the
        current repo assumption).
      </p>
    </div>
  );
}
