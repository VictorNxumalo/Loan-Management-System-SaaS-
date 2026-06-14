export interface DisbursementProofInput {
  organisationName: string;
  borrowerName: string;
  loanReference: string;
  principalFormatted: string;
  disbursedAt: string;
  disbursementMethod: string;
  generatedAt: string;
}

export function buildDisbursementProofHtml(input: DisbursementProofInput): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Disbursement proof — ${input.loanReference}</title>
  <style>
    body { font-family: Georgia, 'Times New Roman', serif; max-width: 720px; margin: 40px auto; padding: 0 24px; color: #111; line-height: 1.5; }
    h1 { font-size: 22px; margin-bottom: 4px; }
    .meta { color: #555; font-size: 14px; margin-bottom: 24px; }
    table { width: 100%; border-collapse: collapse; margin: 20px 0; }
    th, td { text-align: left; padding: 10px 12px; border: 1px solid #ddd; font-size: 14px; }
    th { background: #f5f5f5; width: 38%; }
    footer { margin-top: 32px; font-size: 12px; color: #666; border-top: 1px solid #ddd; padding-top: 16px; }
  </style>
</head>
<body>
  <h1>Loan disbursement proof</h1>
  <p class="meta">Generated automatically by LMS · ${input.generatedAt}</p>
  <table>
    <tr><th>Lender</th><td>${escapeHtml(input.organisationName)}</td></tr>
    <tr><th>Borrower</th><td>${escapeHtml(input.borrowerName)}</td></tr>
    <tr><th>Loan reference</th><td>${escapeHtml(input.loanReference)}</td></tr>
    <tr><th>Amount disbursed</th><td><strong>${escapeHtml(input.principalFormatted)}</strong></td></tr>
    <tr><th>Disbursement date</th><td>${escapeHtml(input.disbursedAt)}</td></tr>
    <tr><th>Method</th><td>${escapeHtml(input.disbursementMethod)}</td></tr>
  </table>
  <footer>
    This document is an immutable audit record of funds released for the referenced loan.
    It was created by the Loan Management System at disbursement time and must not be edited.
  </footer>
</body>
</html>`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
