import { formatNcaRateCapMessage, getNcaMaxAnnualRatePercent } from './nca-rates';

export interface LoanAgreementTemplateInput {
  organisationName: string;
  borrowerName: string;
  principalFormatted: string;
  annualRatePercent: number;
  interestTypeLabel: string;
  termPeriods: number;
  frequencyLabel: string;
  startDate: string;
  generatedAt: string;
  repoRatePercent?: number;
}

export function buildLoanAgreementHtml(input: LoanAgreementTemplateInput): string {
  const maxRate = getNcaMaxAnnualRatePercent(input.repoRatePercent);
  const ncaNotice = formatNcaRateCapMessage(input.repoRatePercent);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Loan agreement — ${escapeHtml(input.borrowerName)}</title>
  <style>
    body { font-family: Georgia, 'Times New Roman', serif; max-width: 720px; margin: 2rem auto; padding: 0 1.5rem; color: #1a1a2e; line-height: 1.55; }
    h1 { font-size: 1.35rem; margin-bottom: 0.25rem; }
    .meta { color: #555; font-size: 0.9rem; margin-bottom: 1.5rem; }
    .notice { background: #f0f7f4; border: 1px solid #b8dfc8; border-radius: 8px; padding: 1rem; margin: 1.25rem 0; font-size: 0.92rem; }
    section { margin: 1.25rem 0; }
    h2 { font-size: 1rem; margin-bottom: 0.5rem; }
    table { width: 100%; border-collapse: collapse; margin-top: 0.5rem; }
    td { padding: 0.35rem 0; vertical-align: top; }
    td:first-child { width: 42%; color: #444; }
    footer { margin-top: 2rem; font-size: 0.85rem; color: #666; border-top: 1px solid #ddd; padding-top: 1rem; }
    @media print { body { margin: 0; } }
  </style>
</head>
<body>
  <h1>Loan agreement (LMS template)</h1>
  <p class="meta">Generated ${escapeHtml(input.generatedAt)} · ${escapeHtml(input.organisationName)}</p>

  <div class="notice">
    <strong>National Credit Act (NCA) — platform enforcement</strong>
    <p style="margin:0.5rem 0 0">${escapeHtml(ncaNotice)}</p>
    <p style="margin:0.75rem 0 0">This agreement is produced by the Loan Management System (LMS). Lenders may not set interest rates above the NCA cap; LMS validates and blocks non-compliant rates at approval.</p>
  </div>

  <section>
    <h2>Parties</h2>
    <table>
      <tr><td>Lender</td><td>${escapeHtml(input.organisationName)}</td></tr>
      <tr><td>Borrower</td><td>${escapeHtml(input.borrowerName)}</td></tr>
    </table>
  </section>

  <section>
    <h2>Loan terms</h2>
    <table>
      <tr><td>Principal amount</td><td>${escapeHtml(input.principalFormatted)}</td></tr>
      <tr><td>Annual interest rate</td><td>${input.annualRatePercent}% (NCA maximum ${maxRate}%)</td></tr>
      <tr><td>Interest method</td><td>${escapeHtml(input.interestTypeLabel)}</td></tr>
      <tr><td>Term</td><td>${input.termPeriods} ${escapeHtml(input.frequencyLabel)} instalment(s)</td></tr>
      <tr><td>Commencement date</td><td>${escapeHtml(input.startDate)}</td></tr>
    </table>
  </section>

  <section>
    <h2>Standard conditions</h2>
    <ol>
      <li>The borrower agrees to repay principal and interest according to the amortisation schedule recorded in LMS after loan activation.</li>
      <li>Disbursement occurs via LMS to the borrower&apos;s linked bank account or wallet, subject to lender activation and available funds.</li>
      <li>Both parties acknowledge that LMS maintains audit records of applications, approvals, disbursements, and repayments.</li>
      <li>Interest charged shall not exceed the NCA maximum; any attempt to approve a higher rate is rejected by the platform.</li>
    </ol>
  </section>

  <footer>
    <p>This document is a system-generated draft for review. Retain a signed copy for your records if required by your internal compliance process. LMS does not replace independent legal advice.</p>
  </footer>
</body>
</html>`;
}

export interface LoanAgreementSignatureInput {
  signerName: string;
  signerEmail: string;
  idNumber: string;
  organisationName: string;
  signedAt: string;
}

export function appendLoanAgreementSignature(
  html: string,
  signature: LoanAgreementSignatureInput,
): string {
  const acknowledgment = `I, ${signature.signerName}, acknowledge and accept the terms of this loan agreement with ${signature.organisationName}. I confirm that the interest rate shown complies with the NCA cap enforced by LMS and authorise disbursement upon lender action after this signature.`;

  const block = `
  <section class="notice" style="margin-top:2rem;border-color:#2d6a4f;background:#edf7f1;">
    <h2>Digital signature — borrower acknowledgment</h2>
    <p style="margin:0.75rem 0">${escapeHtml(acknowledgment)}</p>
    <table style="margin-top:1rem">
      <tr><td>Signed by</td><td>${escapeHtml(signature.signerName)}</td></tr>
      <tr><td>Email</td><td>${escapeHtml(signature.signerEmail)}</td></tr>
      <tr><td>SA ID number</td><td>${escapeHtml(signature.idNumber)}</td></tr>
      <tr><td>Signed at</td><td>${escapeHtml(signature.signedAt)} (UTC)</td></tr>
      <tr><td>Platform</td><td>Loan Management System (LMS) — electronic signature</td></tr>
    </table>
  </section>`;

  return html.replace('</body>', `${block}\n</body>`);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
