'use client';

import {
  DEFAULT_NCR_REPO_RATE_PERCENT,
  formatNcaRateCapMessage,
  getNcaMaxAnnualRatePercent,
  isAnnualRateWithinNcaCap,
} from '@lms/utils';

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
