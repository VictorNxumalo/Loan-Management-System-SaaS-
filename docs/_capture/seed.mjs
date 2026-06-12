/**
 * Seeds demo accounts + data for the user-guide screenshots.
 * Idempotent: re-running logs in instead of re-registering.
 */
const API = 'http://localhost:3001/v1';
const PASSWORD = 'DemoPass123!';

const out = {};

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
  try { json = text ? JSON.parse(text) : null; } catch { json = text; }
  if (!res.ok) {
    const err = new Error(`${method} ${path} -> ${res.status}: ${text.slice(0, 300)}`);
    err.status = res.status;
    err.body = json;
    throw err;
  }
  return json;
}

async function registerOrLogin(name, email, accountType) {
  try {
    await api('/auth/register', { method: 'POST', body: { name, email, password: PASSWORD, accountType } });
    console.log(`registered ${email}`);
  } catch (e) {
    if (e.status === 409 || e.status === 400 || e.status === 422) {
      console.log(`${email} already exists (${e.status}) — logging in`);
    } else throw e;
  }
  const tokens = await api('/auth/login', { method: 'POST', body: { email, password: PASSWORD } });
  return tokens;
}

function isoDaysFromNow(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

async function main() {
  // ── 1. Lender admin (onboarded) ────────────────────────────────
  const lender = await registerOrLogin('Thandi Mokoena', 'demo.lender@lmsguide.dev', 'LENDER');
  let lt = lender.accessToken;
  let me = await api('/auth/me', { token: lt });
  if (!me.user.onboardingCompleted) {
    await api('/auth/onboarding', {
      method: 'PATCH', token: lt,
      body: { organisationName: 'Ubuntu Capital (Demo)', defaultCurrency: 'ZAR', defaultInterestType: 'REDUCING' },
    });
    // re-login so token carries orgId
    const re = await api('/auth/login', { method: 'POST', body: { email: 'demo.lender@lmsguide.dev', password: PASSWORD } });
    lt = re.accessToken;
    me = await api('/auth/me', { token: lt });
    console.log('lender onboarding completed');
  }
  out.orgId = me.organisation.id;
  console.log('orgId:', out.orgId);

  // Public listing on
  await api('/settings/organisation', { method: 'PATCH', token: lt, body: { publicListing: true } });

  // ── 2. Fresh (non-onboarded) accounts for onboarding screenshots ─
  await registerOrLogin('Lerato Ndlovu', 'demo.lender.new@lmsguide.dev', 'LENDER');
  await registerOrLogin('Kabelo Mthembu', 'demo.borrower.new@lmsguide.dev', 'BORROWER');

  // ── 3. Borrower (onboarded) ────────────────────────────────────
  const borrower = await registerOrLogin('Sipho Dlamini', 'demo.borrower@lmsguide.dev', 'BORROWER');
  let bt = borrower.accessToken;
  let bme = await api('/auth/me', { token: bt });
  if (!bme.user.onboardingCompleted) {
    await api('/auth/borrower-onboarding', {
      method: 'PATCH', token: bt,
      body: { phone: '+27821234567', idNumber: '9001015800087' },
    });
    const re = await api('/auth/login', { method: 'POST', body: { email: 'demo.borrower@lmsguide.dev', password: PASSWORD } });
    bt = re.accessToken;
    console.log('borrower onboarding completed');
  }

  // ── 4. Lender CRM borrowers + loans ────────────────────────────
  const existing = await api('/borrowers?limit=50', { token: lt });
  const findBorrower = (name) => existing.items.find((b) => b.fullName === name);

  let naledi = findBorrower('Naledi Khumalo');
  if (!naledi) {
    naledi = await api('/borrowers', {
      method: 'POST', token: lt,
      body: {
        fullName: 'Naledi Khumalo', idNumber: '8805124800083', phone: '+27835551234',
        email: 'naledi.k@example.com', address: '12 Vilakazi Street, Soweto, Johannesburg',
        employer: 'Pick n Pay', monthlyIncomeCents: 1850000,
      },
    });
    console.log('created CRM borrower Naledi');
  }

  let bongani = findBorrower('Bongani Sithole');
  if (!bongani) {
    bongani = await api('/borrowers', {
      method: 'POST', token: lt,
      body: {
        fullName: 'Bongani Sithole', idNumber: '9203035800082', phone: '+27725559876',
        email: 'bongani.s@example.com', employer: 'Self-employed (taxi operator)', monthlyIncomeCents: 2400000,
      },
    });
    console.log('created CRM borrower Bongani');
  }

  const loans = await api('/loans?limit=50', { token: lt });
  const hasLoanFor = (bid) => loans.items.some((l) => l.borrowerId === bid);

  // Active loan with repayments (started ~3 months ago)
  if (!hasLoanFor(naledi.id)) {
    const loan1 = await api('/loans', {
      method: 'POST', token: lt,
      body: {
        borrowerId: naledi.id, principalCents: 1500000, annualRate: 14, interestType: 'REDUCING',
        termPeriods: 12, frequency: 'MONTHLY', startDate: isoDaysFromNow(-92),
      },
    });
    await api(`/loans/${loan1.id}/activate`, { method: 'POST', token: lt });
    await api(`/loans/${loan1.id}/repayments`, {
      method: 'POST', token: lt,
      body: { amountCents: 134700, paymentDate: isoDaysFromNow(-60), note: 'EFT — March instalment' },
    });
    await api(`/loans/${loan1.id}/repayments`, {
      method: 'POST', token: lt,
      body: { amountCents: 134700, paymentDate: isoDaysFromNow(-31), note: 'EFT — April instalment' },
    });
    out.loan1 = loan1.id;
    console.log('created + activated loan for Naledi with 2 repayments');
  }

  // Loan in arrears (no repayments, started 4 months ago)
  if (!hasLoanFor(bongani.id)) {
    const loan2 = await api('/loans', {
      method: 'POST', token: lt,
      body: {
        borrowerId: bongani.id, principalCents: 800000, annualRate: 18, interestType: 'FLAT',
        termPeriods: 6, frequency: 'MONTHLY', startDate: isoDaysFromNow(-122),
      },
    });
    await api(`/loans/${loan2.id}/activate`, { method: 'POST', token: lt });
    out.loan2 = loan2.id;
    console.log('created + activated overdue loan for Bongani');
  }

  // ── 5. Borrower connects + applies ─────────────────────────────
  try {
    await api(`/borrower/lenders/${out.orgId}/connect`, { method: 'POST', token: bt });
    console.log('borrower connected to org');
  } catch (e) {
    console.log('connect skipped:', e.status);
  }

  // Only ONE pending application per lender is allowed, so:
  // 1) approve any currently-SUBMITTED app, 2) then submit a fresh pending one.
  let myApps = await api('/borrower/applications?limit=50', { token: bt });
  let items = myApps.items ?? myApps;

  let approved = items.find((a) => a.status === 'APPROVED');
  if (!approved) {
    let toApprove = items.find((a) => a.status === 'SUBMITTED');
    if (!toApprove) {
      toApprove = await api('/borrower/applications', {
        method: 'POST', token: bt,
        body: {
          orgId: out.orgId, principalCents: 1200000, interestType: 'REDUCING', termPeriods: 12,
          frequency: 'MONTHLY', startDate: isoDaysFromNow(7),
          purpose: 'School fees and uniforms for the new term.',
        },
      });
    }
    const result = await api(`/applications/${toApprove.id}/approve`, {
      method: 'POST', token: lt,
      body: { annualRate: 15, lenderNotes: 'Approved at 15% based on income verification.' },
    });
    await api(`/loans/${result.loanId}/activate`, { method: 'POST', token: lt });
    out.approvedAppId = toApprove.id;
    out.borrowerLoanId = result.loanId;
    console.log('approved application + activated borrower loan');
  } else {
    out.approvedAppId = approved.id;
    out.borrowerLoanId = approved.loanId;
  }

  // Fresh application left SUBMITTED (for the lender review screenshot)
  myApps = await api('/borrower/applications?limit=50', { token: bt });
  items = myApps.items ?? myApps;
  let pending = items.find((a) => a.status === 'SUBMITTED');
  if (!pending) {
    pending = await api('/borrower/applications', {
      method: 'POST', token: bt,
      body: {
        orgId: out.orgId, principalCents: 800000, interestType: 'REDUCING', termPeriods: 6,
        frequency: 'MONTHLY', startDate: isoDaysFromNow(14),
        purpose: 'Stock purchase for my spaza shop ahead of the festive season.',
      },
    });
    console.log('submitted pending application');
  }
  out.pendingAppId = pending.id;

  // ── 6. Mark overdue loans (dev admin cron trigger) ─────────────
  try {
    await api('/admin/run-overdue-check', { method: 'POST', token: lt });
    console.log('overdue check ran');
  } catch (e) {
    console.log('overdue check skipped:', e.status);
  }

  console.log('SEED RESULT', JSON.stringify(out, null, 2));
}

main().catch((e) => { console.error('SEED FAILED:', e.message, e.body ?? ''); process.exit(1); });
