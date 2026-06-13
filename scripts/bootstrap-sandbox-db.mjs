/**
 * Apply Prisma migrations to a fresh sandbox Supabase project.
 *
 * Usage:
 *   node scripts/bootstrap-sandbox-db.mjs --env-file .env.sandbox.local
 *
 * .env.sandbox.local should contain DATABASE_URL and DIRECT_URL (gitignored).
 */
import { readFileSync, existsSync, renameSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const rootEnvPath = join(root, '.env');
const rootEnvBackup = join(root, '.env.bootstrap-bak');

function loadEnvFile(path) {
  if (!existsSync(path)) {
    console.error(`Env file not found: ${path}`);
    process.exit(1);
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

const envArg = process.argv.indexOf('--env-file');
if (envArg !== -1 && process.argv[envArg + 1]) {
  loadEnvFile(process.argv[envArg + 1]);
}

if (!process.env.DATABASE_URL || !process.env.DIRECT_URL) {
  console.error(
    'DATABASE_URL and DIRECT_URL are required.\n' +
      'Example: node scripts/bootstrap-sandbox-db.mjs --env-file .env.sandbox.local',
  );
  process.exit(1);
}

console.log('Running prisma migrate deploy against sandbox database…');
const host = process.env.DIRECT_URL?.replace(/:[^:@/]+@/, ':***@') ?? '(unknown)';
console.log(`Target (direct): ${host}`);

// Prisma always loads repo `.env` — hide it so sandbox credentials are used.
let restoredRootEnv = false;
if (existsSync(rootEnvPath)) {
  renameSync(rootEnvPath, rootEnvBackup);
  restoredRootEnv = true;
}

const childEnv = {
  ...process.env,
  DATABASE_URL: process.env.DATABASE_URL,
  DIRECT_URL: process.env.DIRECT_URL,
};

let result;
try {
  result = spawnSync('pnpm', ['db:migrate:deploy'], {
    cwd: root,
    stdio: 'inherit',
    env: childEnv,
    shell: true,
  });
} finally {
  if (restoredRootEnv && existsSync(rootEnvBackup)) {
    renameSync(rootEnvBackup, rootEnvPath);
  }
}

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}

console.log('\nSandbox database ready. Next: set Supabase env vars on Render sandbox API.');
