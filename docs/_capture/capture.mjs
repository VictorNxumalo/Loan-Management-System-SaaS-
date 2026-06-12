/**
 * Captures user-guide screenshots by driving the real app with the system Edge browser.
 * Output: docs/img/*.png
 */
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';

const WEB = 'http://localhost:3000';
const API = 'http://localhost:3001/v1';
const PASSWORD = 'DemoPass123!';
const OUT = path.resolve(import.meta.dirname, '..', 'img');
fs.mkdirSync(OUT, { recursive: true });

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function apiLogin(email) {
  const res = await fetch(`${API}/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: PASSWORD }),
  });
  if (!res.ok) throw new Error(`login ${email}: ${res.status}`);
  return res.json();
}
async function apiGet(pathname, token) {
  const res = await fetch(`${API}${pathname}`, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`GET ${pathname}: ${res.status}`);
  return res.json();
}

async function newPage(browser) {
  const ctx = await browser.createBrowserContext();
  const page = await ctx.newPage();
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1.5 });
  return { ctx, page };
}

async function uiLogin(page, email) {
  await page.goto(`${WEB}/auth/login`, { waitUntil: 'networkidle0' });
  await page.type('input[type="email"]', email, { delay: 10 });
  await page.type('input[type="password"]', PASSWORD, { delay: 10 });
  await page.click('button[type="submit"]');
  await page.waitForFunction(
    () => ['/dashboard', '/borrower', '/onboarding'].some((p) => location.pathname.startsWith(p)),
    { timeout: 150000, polling: 500 },
  );
  await sleep(1200);
}

async function shoot(page, url, name, { fullPage = true, settle = 1400 } = {}) {
  if (url) {
    await page.goto(`${WEB}${url}`, { waitUntil: 'networkidle0', timeout: 60000 });
    await sleep(settle);
  }
  await page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage });
  console.log(`shot: ${name}`);
}

async function main() {
  // Resolve entity ids for detail pages
  const lender = await apiLogin('demo.lender@lmsguide.dev');
  const lt = lender.accessToken;
  const orgId = lender.organisation.id;
  const orgName = lender.organisation.name;
  const borrowers = await apiGet('/borrowers?limit=50', lt);
  const naledi = borrowers.items.find((b) => b.fullName === 'Naledi Khumalo');
  const loans = await apiGet('/loans?limit=50', lt);
  const nalediLoan = loans.items.find((l) => l.borrowerId === naledi.id);
  const apps = await apiGet('/applications?status=SUBMITTED&limit=10', lt);
  const pendingApp = apps.items[0];

  const borrower = await apiLogin('demo.borrower@lmsguide.dev');
  const bt = borrower.accessToken;
  const bLoans = await apiGet('/borrower/loans?limit=10', bt);
  const bLoanItems = bLoans.items ?? bLoans;
  const bLoan = bLoanItems[0];
  const bApps = await apiGet('/borrower/applications?limit=10', bt);
  const bAppItems = bApps.items ?? bApps;
  const bPending = bAppItems.find((a) => a.status === 'SUBMITTED');
  const bApproved = bAppItems.find((a) => a.status === 'APPROVED');

  console.log({ orgId, naledi: naledi.id, nalediLoan: nalediLoan?.id, pendingApp: pendingApp?.id, bLoan: bLoan?.id });

  const browser = await puppeteer.launch({
    executablePath: EDGE,
    headless: true,
    args: ['--window-size=1460,950', '--disable-gpu'],
  });

  const sections = new Set(process.argv.slice(2));
  const run = (name) => sections.size === 0 || sections.has(name);

  // ── Public pages ────────────────────────────────────────────────
  if (run('public')) {
    const { ctx, page } = await newPage(browser);
    await shoot(page, '/', 'public-landing');
    await shoot(page, '/auth/login', 'auth-login');
    await shoot(page, '/auth/register?type=lender', 'auth-register-lender');
    await shoot(page, '/auth/register?type=borrower', 'auth-register-borrower');
    await ctx.close();
  }

  // ── Fresh lender → onboarding ───────────────────────────────────
  if (run('onboarding')) {
    const { ctx, page } = await newPage(browser);
    await uiLogin(page, 'demo.lender.new@lmsguide.dev');
    await shoot(page, '/onboarding', 'lender-onboarding');
    await ctx.close();
  }

  // ── Fresh borrower → onboarding ─────────────────────────────────
  if (run('onboarding')) {
    const { ctx, page } = await newPage(browser);
    await uiLogin(page, 'demo.borrower.new@lmsguide.dev');
    await shoot(page, '/borrower/onboarding', 'borrower-onboarding');
    await ctx.close();
  }

  // ── Lender journey ──────────────────────────────────────────────
  if (run('lender')) {
    const { ctx, page } = await newPage(browser);
    await uiLogin(page, 'demo.lender@lmsguide.dev');
    await shoot(page, '/dashboard', 'lender-dashboard');
    await shoot(page, '/dashboard/borrowers', 'lender-borrowers');
    await shoot(page, '/dashboard/borrowers/new', 'lender-borrower-new');
    await shoot(page, `/dashboard/borrowers/${naledi.id}`, 'lender-borrower-detail');
    await shoot(page, '/dashboard/loans', 'lender-loans');

    // New loan + schedule preview
    await page.goto(`${WEB}/dashboard/loans/new?borrowerId=${naledi.id}`, { waitUntil: 'networkidle0' });
    await sleep(1500);
    await shoot(page, null, 'lender-loan-new');
    try {
      const btn = await page.$('button::-p-text(Preview)');
      if (btn) {
        await btn.click();
        await sleep(2500);
        await shoot(page, null, 'lender-loan-preview');
      }
    } catch (e) { console.log('preview skipped:', e.message); }

    await shoot(page, `/dashboard/loans/${nalediLoan.id}`, 'lender-loan-detail');
    await shoot(page, '/dashboard/applications', 'lender-applications');
    if (pendingApp) await shoot(page, `/dashboard/applications/${pendingApp.id}`, 'lender-application-review');
    await shoot(page, '/dashboard/team', 'lender-team');
    await shoot(page, '/dashboard/settings', 'lender-settings');
    await shoot(page, '/dashboard/audit-log', 'lender-audit-log');

    await ctx.close();
  }

  // ── Notification bell dropdown ──────────────────────────────────
  if (run('lender') || run('bell')) {
    const { ctx, page } = await newPage(browser);
    await uiLogin(page, 'demo.lender@lmsguide.dev');
    try {
      await page.goto(`${WEB}/dashboard`, { waitUntil: 'networkidle0' });
      await sleep(1500);
      const clicked = await page.evaluate(() => {
        const svg = document.querySelector('svg.lucide-bell');
        const btn = svg ? svg.closest('button') : null;
        if (btn) { btn.click(); return true; }
        return false;
      });
      if (clicked) {
        await sleep(3500);
        await shoot(page, null, 'lender-notifications', { fullPage: false });
      }
    } catch (e) { console.log('bell skipped:', e.message); }
    await ctx.close();
  }

  // ── Borrower journey ────────────────────────────────────────────
  if (run('borrower')) {
    const { ctx, page } = await newPage(browser);
    await uiLogin(page, 'demo.borrower@lmsguide.dev');
    await shoot(page, '/borrower', 'borrower-home');
    await shoot(page, '/borrower/lenders/browse', 'borrower-browse-lenders');
    await shoot(page, '/borrower/lenders/mine', 'borrower-my-lenders');
    await shoot(page, '/borrower/applications', 'borrower-applications');
    await shoot(page, `/borrower/applications/new?orgId=${orgId}&lenderName=${encodeURIComponent(orgName)}`, 'borrower-application-new');
    if (bPending) await shoot(page, `/borrower/applications/${bPending.id}`, 'borrower-application-pending');
    if (bApproved) await shoot(page, `/borrower/applications/${bApproved.id}`, 'borrower-application-approved');
    await shoot(page, '/borrower/loans', 'borrower-loans');
    if (bLoan) await shoot(page, `/borrower/loans/${bLoan.id}`, 'borrower-loan-detail');
    await ctx.close();
  }

  await browser.close();
  console.log('DONE — screenshots in', OUT);
}

main().catch((e) => { console.error('CAPTURE FAILED:', e); process.exit(1); });
