import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PrismaClient } from '@prisma/client';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function loadEnvFile(path) {
  if (!existsSync(path)) {
    throw new Error(`Env file not found: ${path}`);
  }
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const i = trimmed.indexOf('=');
    if (i === -1) continue;
    const key = trimmed.slice(0, i).trim();
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

function getArg(name) {
  const idx = process.argv.indexOf(name);
  return idx !== -1 ? process.argv[idx + 1] : undefined;
}

const emailArg = getArg('--email');
if (!emailArg) {
  console.error('Usage: node scripts/delete-user-by-email.mjs --email <email> [--env-file .env]');
  process.exit(1);
}
const email = emailArg.trim().toLowerCase();

const envFileArg = getArg('--env-file');
const envPath = envFileArg
  ? envFileArg.startsWith('/') || /^[A-Za-z]:/.test(envFileArg)
    ? envFileArg
    : join(root, envFileArg)
  : join(root, '.env');

loadEnvFile(envPath);

const directUrl = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
if (!directUrl) {
  console.error('DIRECT_URL or DATABASE_URL must be set');
  process.exit(1);
}

const prisma = new PrismaClient({ datasources: { db: { url: directUrl } } });

async function removeUserByEmail(targetEmail) {
  const user = await prisma.user.findFirst({
    where: { email: targetEmail, deletedAt: null },
    select: { id: true, email: true, accountType: true, orgId: true },
  });

  if (!user) {
    console.log(`No active user found for ${targetEmail}`);
    return;
  }

  const [createdLoans, recordedRepayments] = await Promise.all([
    prisma.loan.count({ where: { createdByUserId: user.id } }),
    prisma.repayment.count({ where: { recordedByUserId: user.id } }),
  ]);

  if (createdLoans > 0 || recordedRepayments > 0) {
    throw new Error(
      `Refusing delete: user owns business records (loans=${createdLoans}, repayments=${recordedRepayments}).`,
    );
  }

  const wallet = await prisma.wallet.findFirst({
    where: { ownerUserId: user.id },
    select: { id: true },
  });

  await prisma.$transaction(async (tx) => {
    if (wallet) {
      await tx.walletTransaction.deleteMany({ where: { walletId: wallet.id } });
      await tx.walletBankAccount.deleteMany({ where: { walletId: wallet.id } });
      await tx.wallet.deleteMany({ where: { id: wallet.id } });
    }

    await tx.notification.deleteMany({ where: { userId: user.id } });
    await tx.auditLog.deleteMany({ where: { userId: user.id } });
    await tx.document.deleteMany({ where: { uploadedByUserId: user.id } });
    await tx.paymentSubmission.deleteMany({
      where: { OR: [{ submittedByUserId: user.id }, { reviewedByUserId: user.id }] },
    });

    await tx.loanApplication.updateMany({
      where: { reviewedByUserId: user.id },
      data: { reviewedByUserId: null, reviewedAt: null },
    });
    await tx.loanApplication.deleteMany({ where: { borrowerUserId: user.id } });

    await tx.teamInvite.deleteMany({
      where: { invitedByUserId: user.id },
    });
    await tx.borrowerLenderLink.deleteMany({ where: { borrowerUserId: user.id } });
    await tx.borrowerAccount.deleteMany({ where: { userId: user.id } });
    await tx.userKycDocument.deleteMany({ where: { userId: user.id } });
    await tx.refreshToken.deleteMany({ where: { userId: user.id } });
    await tx.emailVerificationToken.deleteMany({ where: { userId: user.id } });
    await tx.passwordResetToken.deleteMany({ where: { userId: user.id } });

    await tx.user.deleteMany({ where: { id: user.id } });
  }, { timeout: 30000, maxWait: 10000 });

  console.log(`Deleted user: ${user.email} (${user.id})`);
}

removeUserByEmail(email)
  .catch((err) => {
    console.error(err.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
