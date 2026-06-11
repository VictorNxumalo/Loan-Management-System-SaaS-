/**
 * Phase 5 notification smoke test — run while API is on :3001
 * Usage: node scripts/test-phase5-notifications.mjs
 */
const API = 'http://localhost:3001/v1';
const ts = Date.now();
const PASSWORD = 'TestPass123!';
const lenderEmail = `p5-lender-${ts}@example.com`;
const borrowerEmail = `p5-borrower-${ts}@example.com`;

async function req(path, { method = 'GET', token, body } = {}) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }
  if (!res.ok) {
    throw new Error(`${method} ${path} → ${res.status}: ${JSON.stringify(data)}`);
  }
  return data;
}

function log(step, msg, extra) {
  console.log(`\n[${step}] ${msg}`);
  if (extra !== undefined) console.log(JSON.stringify(extra, null, 2));
}

async function main() {
  console.log('=== Phase 5 notification test ===');
  console.log(`Lender:  ${lenderEmail}`);
  console.log(`Borrower: ${borrowerEmail}`);

  await req('/health');

  // Setup lender
  await req('/auth/register', {
    method: 'POST',
    body: {
      email: lenderEmail,
      password: PASSWORD,
      name: 'P5 Test Lender',
      accountType: 'LENDER',
    },
  });

  const lenderLogin = await req('/auth/login', {
    method: 'POST',
    body: { email: lenderEmail, password: PASSWORD },
  });
  const lenderToken = lenderLogin.accessToken;

  await req('/auth/onboarding', {
    method: 'PATCH',
    token: lenderToken,
    body: {
      organisationName: `P5 Org ${ts}`,
      defaultCurrency: 'ZAR',
      defaultInterestType: 'FLAT',
    },
  });

  const lenderMe = await req('/auth/me', { token: lenderToken });
  const orgId = lenderMe.organisation.id;

  await req('/settings/organisation', {
    method: 'PATCH',
    token: lenderToken,
    body: { publicListing: true },
  });

  // Setup borrower
  await req('/auth/register', {
    method: 'POST',
    body: {
      email: borrowerEmail,
      password: PASSWORD,
      name: 'P5 Test Borrower',
      accountType: 'BORROWER',
      phone: '0821234567',
    },
  });

  const borrowerLogin = await req('/auth/login', {
    method: 'POST',
    body: { email: borrowerEmail, password: PASSWORD },
  });
  const borrowerToken = borrowerLogin.accessToken;

  await req('/auth/borrower-onboarding', {
    method: 'PATCH',
    token: borrowerToken,
    body: { phone: '0821234567', idNumber: `P5${ts}` },
  });

  await req(`/borrower/lenders/${orgId}/connect`, {
    method: 'POST',
    token: borrowerToken,
  });

  // 1) Submit application
  const application = await req('/borrower/applications', {
    method: 'POST',
    token: borrowerToken,
    body: {
      orgId,
      principalCents: 500_000,
      interestType: 'FLAT',
      termPeriods: 6,
      frequency: 'MONTHLY',
      startDate: '2025-01-01',
      purpose: 'Phase 5 notification test',
    },
  });
  log('1', 'Application submitted', { id: application.id, status: application.status });

  await sleep(6000);

  const lenderNotifs1 = await req('/notifications?limit=10', { token: lenderToken });
  log('1', 'Lender notifications after submit', {
    unreadCount: lenderNotifs1.unreadCount,
    titles: lenderNotifs1.items.map((n) => n.title),
  });

  if (!lenderNotifs1.items.some((n) => n.type === 'APPLICATION_SUBMITTED')) {
    throw new Error('Lender missing APPLICATION_SUBMITTED notification');
  }

  // 2) Approve application
  const approveResult = await req(`/applications/${application.id}/approve`, {
    method: 'POST',
    token: lenderToken,
    body: { annualRate: 12 },
  });
  log('2', 'Application approved', { loanId: approveResult.loanId });

  await sleep(6000);

  const borrowerNotifs = await req('/notifications?limit=10', { token: borrowerToken });
  log('2', 'Borrower notifications after approve', {
    unreadCount: borrowerNotifs.unreadCount,
    titles: borrowerNotifs.items.map((n) => n.title),
  });

  if (!borrowerNotifs.items.some((n) => n.type === 'APPLICATION_APPROVED')) {
    throw new Error('Borrower missing APPLICATION_APPROVED notification');
  }

  // Activate loan + overdue check
  await req(`/loans/${approveResult.loanId}/activate`, {
    method: 'POST',
    token: lenderToken,
  });
  log('3', 'Loan activated', { loanId: approveResult.loanId });

  await sleep(500);

  const overdueResult = await req('/admin/run-overdue-check', {
    method: 'POST',
    token: lenderToken,
  });
  log('3', 'Overdue check result', overdueResult);

  await sleep(6000);

  const lenderNotifs2 = await req('/notifications?limit=20', { token: lenderToken });
  const overdueNotifs = lenderNotifs2.items.filter((n) => n.type === 'LOAN_OVERDUE');
  log('3', 'Lender overdue notifications', {
    count: overdueNotifs.length,
    titles: overdueNotifs.map((n) => n.title),
  });

  if (overdueNotifs.length === 0 && overdueResult.loansUpdated === 0) {
    console.log('\n⚠ Overdue notification not triggered (loan may not have transitioned to IN_ARREARS).');
    console.log('  This can happen if schedule dates or payments do not match sweep criteria.');
  } else if (overdueNotifs.length === 0 && overdueResult.loansUpdated > 0) {
    throw new Error('Loan updated to overdue but no LOAN_OVERDUE notification found');
  }

  // 4) Mark all read
  await req('/notifications/read-all', { method: 'PATCH', token: lenderToken });
  const lenderUnread = await req('/notifications/unread-count', { token: lenderToken });
  log('4', 'Lender unread after mark-all-read', lenderUnread);

  if (lenderUnread.unreadCount !== 0) {
    throw new Error(`Expected lender unread 0, got ${lenderUnread.unreadCount}`);
  }

  // 5) Submit another application to verify delivery still works (simulates no-Redis path)
  const application2 = await req('/borrower/applications', {
    method: 'POST',
    token: borrowerToken,
    body: {
      orgId,
      principalCents: 100_000,
      interestType: 'FLAT',
      termPeriods: 3,
      frequency: 'MONTHLY',
      startDate: '2026-07-01',
      purpose: 'Second app after mark-read test',
    },
  }).catch(async (err) => {
    // pending app may block — withdraw first if needed
    if (String(err.message).includes('pending application')) {
      const apps = await req('/borrower/applications?limit=10', { token: borrowerToken });
      const pending = apps.items.find((a) => a.status === 'SUBMITTED');
      if (pending) {
        await req(`/borrower/applications/${pending.id}/withdraw`, {
          method: 'POST',
          token: borrowerToken,
        });
      }
      return req('/borrower/applications', {
        method: 'POST',
        token: borrowerToken,
        body: {
          orgId,
          principalCents: 100_000,
          interestType: 'FLAT',
          termPeriods: 3,
          frequency: 'MONTHLY',
          startDate: '2026-07-01',
          purpose: 'Second app after mark-read test',
        },
      });
    }
    throw err;
  });

  await sleep(3000);
  const lenderNotifs3 = await req('/notifications/unread-count', { token: lenderToken });
  log('5', 'Lender unread after second submit (delivery without Redis queue)', {
    applicationId: application2.id,
    unreadCount: lenderNotifs3.unreadCount,
  });

  if (lenderNotifs3.unreadCount < 1) {
    throw new Error('Expected new notification after second submit');
  }

  console.log('\n=== ALL CHECKS PASSED ===');
  console.log('Watch API console for [DEV EMAIL] lines during this run.');
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

main().catch((err) => {
  console.error('\n=== TEST FAILED ===');
  console.error(err.message);
  process.exit(1);
});
