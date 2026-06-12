/**
 * Clear all LMS staging data (users, orgs, loans, storage objects).
 *
 * Usage:
 *   pnpm db:reset:staging
 *
 * Uses DIRECT_URL (session pooler) from repo root .env — required for TRUNCATE on Supabase.
 */
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PrismaClient } from '@prisma/client';

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
  "payment_submissions",
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

async function main() {
  await prisma.$executeRawUnsafe(TRUNCATE_SQL);
  console.log('✓ Truncated all LMS tables');

  try {
    const deleted = await prisma.$executeRawUnsafe(
      `DELETE FROM storage.objects WHERE bucket_id = 'lms-documents'`,
    );
    console.log(`✓ Cleared storage bucket (rows affected: ${String(deleted)})`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn(
      `⚠ Storage cleanup skipped (${message}).\n` +
        '  Empty bucket "lms-documents" in Supabase → Storage if files remain.',
    );
  }

  const [users, orgs] = await Promise.all([
    prisma.user.count(),
    prisma.organisation.count(),
  ]);

  if (users !== 0 || orgs !== 0) {
    throw new Error(`Reset incomplete: users=${users}, organisations=${orgs}`);
  }

  console.log('\nDone. Database is empty — register fresh on your Vercel staging URL.\n');
}

main()
  .catch((err) => {
    console.error('Reset failed:', err instanceof Error ? err.message : err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
