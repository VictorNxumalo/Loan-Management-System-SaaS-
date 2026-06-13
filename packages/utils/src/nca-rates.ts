/** Default SA repo rate (% p.a.) — override via NCR_REPO_RATE_PERCENT on the API. */
export const DEFAULT_NCR_REPO_RATE_PERCENT = 8.25;

/**
 * NCA maximum annual interest rate for unsecured credit agreements
 * (National Credit Act, Regulation 42): (repo rate × 2.2) + 20 percent per annum.
 */
export function getNcaMaxAnnualRatePercent(
  repoRatePercent = DEFAULT_NCR_REPO_RATE_PERCENT,
): number {
  return Math.round((repoRatePercent * 2.2 + 20) * 100) / 100;
}

export function isAnnualRateWithinNcaCap(
  annualRatePercent: number,
  repoRatePercent = DEFAULT_NCR_REPO_RATE_PERCENT,
): boolean {
  return (
    Number.isFinite(annualRatePercent) &&
    annualRatePercent >= 0 &&
    annualRatePercent <= getNcaMaxAnnualRatePercent(repoRatePercent)
  );
}

export function formatNcaRateCapMessage(
  repoRatePercent = DEFAULT_NCR_REPO_RATE_PERCENT,
): string {
  const max = getNcaMaxAnnualRatePercent(repoRatePercent);
  return `Maximum allowed annual rate under the NCA is ${max}% (repo ${repoRatePercent}% × 2.2 + 20%). LMS blocks rates above this cap.`;
}
