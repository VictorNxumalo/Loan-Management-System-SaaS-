/**
 * Staging smoke test — full lender + borrower payment flow against a hosted API.
 *
 * Usage:
 *   STAGING_API_URL=https://your-api.onrender.com/v1 node scripts/staging-smoke-test.mjs
 *
 * Requires Supabase storage configured on the API (proof-of-payment upload).
 * Uses disposable test emails and small amounts (R500 instalment).
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const API = (process.env.STAGING_API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/v1').replace(/\/$/, '');
const PASSWORD = process.env.STAGING_TEST_PASSWORD ?? 'StagingTest123!';
const runId = Date.now().toString(36);
const lenderEmail = `staging.lender.${runId}@test.local`;
const borrowerEmail = `staging.borrower.${runId}@test.local`;

const STAGING_TEST_BANK_DETAILS = {
  accountHolder: 'Staging Borrower',
  bankName: 'FNB',
  branchCode: '250655',
  accountNumber: '62000012345',
};

const proofPath = join(dirname(fileURLToPath(import.meta.url)), '../fixtures/fake-eft-proof-of-payment.pdf');
const proofBytes = readFileSync(proofPath);

async function api(path, { method = 'GET', token, body } = {}) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = text;
  }
  if (!res.ok) {
    const err = new Error(`${method} ${path} -> ${res.status}: ${text.slice(0, 400)}`);
    err.status = res.status;
    err.body = json;
    throw err;
  }
  return json;
}

function isoDaysFromNow(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

async function uploadApplicationDocument(token, applicationId, documentType, filename, bytes) {
  const uploadMeta = await api(
    `/borrower/applications/${applicationId}/documents/upload-url`,
    {
      method: 'POST',
      token,
      body: {
        documentType,
        filename,
        contentType: 'application/pdf',
        sizeBytes: bytes.length,
      },
    },
  );
  const uploadRes = await fetch(uploadMeta.uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/pdf' },
    body: bytes,
  });
  if (!uploadRes.ok) {
    throw new Error(`${documentType} upload failed: ${uploadRes.status}`);
  }
}

async function registerAndLogin(name, email, accountType) {
  await api('/auth/register', {
    method: 'POST',
    body: { name, email, password: PASSWORD, accountType },
  });
  return api('/auth/login', { method: 'POST', body: { email, password: PASSWORD } });
}

async function main() {
  console.log(`Smoke test against ${API}`);
  if (API.includes('localhost') && !process.env.STAGING_API_URL) {
    console.warn(
      'Tip: set STAGING_API_URL to your Render API (PowerShell: $env:STAGING_API_URL = "https://....onrender.com/v1")',
    );
  }
  console.log(`Lender:  ${lenderEmail}`);
  console.log(`Borrower: ${borrowerEmail}`);

  // ── Lender: register → onboard ─────────────────────────────────
  let { accessToken: lt } = await registerAndLogin('Staging Lender', lenderEmail, 'LENDER');
  await api('/auth/onboarding', {
    method: 'PATCH',
    token: lt,
    body: {
      organisationName: `Staging Capital ${runId}`,
      defaultCurrency: 'ZAR',
      defaultInterestType: 'REDUCING',
    },
  });
  ({ accessToken: lt } = await api('/auth/login', {
    method: 'POST',
    body: { email: lenderEmail, password: PASSWORD },
  }));
  const lenderMe = await api('/auth/me', { token: lt });
  const orgId = lenderMe.organisation.id;
  await api('/settings/organisation', {
    method: 'PATCH',
    token: lt,
    body: { publicListing: true },
  });
  console.log('✓ Lender registered and onboarded');

  // ── Borrower: register → onboard → connect → apply ─────────────
  let { accessToken: bt } = await registerAndLogin('Staging Borrower', borrowerEmail, 'BORROWER');
  await api('/auth/borrower-onboarding', {
    method: 'PATCH',
    token: bt,
    body: { phone: '+27821234567', idNumber: '9001015800087' },
  });
  ({ accessToken: bt } = await api('/auth/login', {
    method: 'POST',
    body: { email: borrowerEmail, password: PASSWORD },
  }));
  await api(`/borrower/lenders/${orgId}/connect`, { method: 'POST', token: bt });
  const application = await api('/borrower/applications', {
    method: 'POST',
    token: bt,
    body: {
      orgId,
      principalCents: 500000,
      interestType: 'REDUCING',
      termPeriods: 6,
      frequency: 'MONTHLY',
      startDate: isoDaysFromNow(7),
      purpose: 'Staging smoke test — small loan.',
      bankDetails: STAGING_TEST_BANK_DETAILS,
    },
  });
  await uploadApplicationDocument(bt, application.id, 'ID_COPY', 'staging-id.pdf', proofBytes);
  await uploadApplicationDocument(
    bt,
    application.id,
    'BANK_STATEMENT',
    'staging-statement.pdf',
    proofBytes,
  );
  await api(`/borrower/applications/${application.id}/submit`, { method: 'POST', token: bt });
  console.log('✓ Borrower applied for loan');

  // ── Lender: checklist → approve → activate ─────────────────────
  await api(`/applications/${application.id}/review-checklist`, {
    method: 'POST',
    token: lt,
    body: {
      idVerified: true,
      bankDetailsVerified: true,
      statementsVerified: true,
      affordabilityReviewed: true,
      purposePlausible: true,
    },
  });
  const approval = await api(`/applications/${application.id}/approve`, {
    method: 'POST',
    token: lt,
    body: { annualRate: 12, lenderNotes: 'Staging auto-approve.' },
  });
  const loanId = approval.loanId;
  await api(`/loans/${loanId}/activate`, { method: 'POST', token: lt });
  console.log(`✓ Lender approved and activated loan ${loanId}`);

  // ── Borrower: pay lender (proof upload + submit) ────────────────
  const submission = await api(`/borrower/loans/${loanId}/payment-submissions`, {
    method: 'POST',
    token: bt,
    body: {
      amountCents: 50000,
      paymentDate: isoDaysFromNow(0),
      referenceNote: `Staging EFT ${runId}`,
    },
  });
  const uploadMeta = await api(
    `/borrower/loans/${loanId}/payment-submissions/${submission.id}/proof/upload-url`,
    {
      method: 'POST',
      token: bt,
      body: {
        filename: 'staging-proof.pdf',
        contentType: 'application/pdf',
        sizeBytes: proofBytes.length,
      },
    },
  );
  const uploadRes = await fetch(uploadMeta.uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/pdf' },
    body: proofBytes,
  });
  if (!uploadRes.ok) {
    throw new Error(`Proof upload failed: ${uploadRes.status}`);
  }
  await api(`/borrower/loans/${loanId}/payment-submissions/${submission.id}/submit`, {
    method: 'POST',
    token: bt,
  });
  console.log('✓ Borrower submitted payment with proof');

  // ── Lender: confirm payment ─────────────────────────────────────
  const confirmed = await api(`/payment-submissions/${submission.id}/confirm`, {
    method: 'POST',
    token: lt,
  });
  console.log(`✓ Lender confirmed payment → repayment ${confirmed.repaymentId}`);

  console.log('\nStaging smoke test PASSED');
  console.log(JSON.stringify({ orgId, loanId, submissionId: submission.id, lenderEmail, borrowerEmail }, null, 2));
}

main().catch((e) => {
  console.error('\nStaging smoke test FAILED:', e.message);
  if (e.body) console.error(e.body);
  process.exit(1);
});
