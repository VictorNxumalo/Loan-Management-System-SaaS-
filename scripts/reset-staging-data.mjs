/**
 * Clear all LMS staging data (users, orgs, loans, storage objects).
 *
 * Usage:
 *   pnpm db:reset:staging
 *
 * Uses DIRECT_URL (session pooler) from repo root .env — required for TRUNCATE on Supabase.
 */
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { PrismaClient } from '@prisma/client';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);

function loadRootEnv() {
  const envPath = join(root, '.env');
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const i = trimmed.indexOf('=');
    if (i === -1) continue;
    const key = trimmed.slice(0, i).trim();
    if (process.env[key] !== undefined) continue;
    let val = trimmed.slice(i + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    process.env[key] = val;
  }
}

loadRootEnv();

const confirmed =
  process.env.RESET_STAGING === '1' || process.argv.includes('--confirm');

if (!confirmed) {
  console.error(
    'Refusing to wipe data without confirmation.\n' +
      'Run:  pnpm db:reset:staging',
  );
  process.exit(1);
}

const directUrl = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
if (!directUrl) {
  console.error('DIRECT_URL or DATABASE_URL must be set in .env');
  process.exit(1);
}

const dbHost = directUrl.includes('supabase')
  ? 'Supabase (hosted)'
  : directUrl.includes('localhost')
    ? 'localhost'
    : 'database';

console.warn(`\n⚠️  Wiping ALL LMS data from ${dbHost}...\n`);

const prisma = new PrismaClient({
  datasources: { db: { url: directUrl } },
});

const TRUNCATE_SQL = `
TRUNCATE TABLE
  "notifications",
  "audit_logs",
  "documents",
  "user_kyc_documents",
  "payment_submissions",
  "wallet_transactions",
  "wallet_bank_accounts",
  "wallets",
  "loan_agreements",
  "loan_stitch_disbursements",
  "organisation_stitch_linkpay",
  "repayments",
  "repayment_schedules",
  "loans",
  "loan_applications",
  "borrowers",
  "subscriptions",
  "team_invites",
  "lender_invites",
  "borrower_lender_links",
  "borrower_accounts",
  "password_reset_tokens",
  "email_verification_tokens",
  "refresh_tokens",
  "users",
  "organisations"
RESTART IDENTITY CASCADE;
`;

async function listStoragePaths(supabase, bucket, prefix = '') {
  const { data, error } = await supabase.storage.from(bucket).list(prefix, {
    limit: 1000,
    sortBy: { column: 'name', order: 'asc' },
  });
  if (error) throw error;
  if (!data?.length) return [];

  const paths = [];
  for (const entry of data) {
    const fullPath = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.id) {
      paths.push(fullPath);
    } else {
      paths.push(...(await listStoragePaths(supabase, bucket, fullPath)));
    }
  }
  return paths;
}

async function clearStorageBucket() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const bucket = process.env.SUPABASE_STORAGE_BUCKET ?? 'lms-documents';

  if (!supabaseUrl || !serviceRoleKey) {
    console.warn(
      '⚠ Storage cleanup skipped (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set).\n' +
        `  Empty bucket "${bucket}" manually in Supabase → Storage.`,
    );
    return;
  }

  let createClient;
  try {
    ({ createClient } = require('@supabase/supabase-js'));
  } catch {
    console.warn(
      '⚠ Storage cleanup skipped (@supabase/supabase-js not installed at repo root).\n' +
        `  Empty bucket "${bucket}" manually in Supabase → Storage.`,
    );
    return;
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const paths = await listStoragePaths(supabase, bucket);
  if (paths.length === 0) {
    console.log(`✓ Storage bucket "${bucket}" already empty`);
    return;
  }

  const batchSize = 100;
  for (let i = 0; i < paths.length; i += batchSize) {
    const batch = paths.slice(i, i + batchSize);
    const { error } = await supabase.storage.from(bucket).remove(batch);
    if (error) throw error;
  }

  console.log(`✓ Cleared ${paths.length} file(s) from storage bucket "${bucket}"`);
}

async function main() {
  await prisma.$executeRawUnsafe(TRUNCATE_SQL);
  console.log('✓ Truncated all LMS tables');

  try {
    await clearStorageBucket();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const bucket = process.env.SUPABASE_STORAGE_BUCKET ?? 'lms-documents';
    console.warn(
      `⚠ Storage cleanup failed (${message}).\n` +
        `  Empty bucket "${bucket}" manually in Supabase → Storage.`,
    );
  }

  const [users, orgs] = await Promise.all([
    prisma.user.count(),
    prisma.organisation.count(),
  ]);

  if (users !== 0 || orgs !== 0) {
    throw new Error(`Reset incomplete: users=${users}, organisations=${orgs}`);
  }

  console.log('\nDone. Database is empty — register fresh on your staging URL.\n');
}

main()
  .catch((err) => {
    console.error('Reset failed:', err instanceof Error ? err.message : err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
