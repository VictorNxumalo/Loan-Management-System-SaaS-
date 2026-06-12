/**
 * Run staging smoke test against the hosted Render API (default URL).
 * Override: STAGING_API_URL=https://other-api.example/v1 node scripts/staging-smoke-hosted.mjs
 */
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const defaultApi = 'https://lms-staging-api-akb1.onrender.com/v1';
const script = join(dirname(fileURLToPath(import.meta.url)), 'staging-smoke-test.mjs');

const result = spawnSync(process.execPath, [script], {
  stdio: 'inherit',
  env: {
    ...process.env,
    STAGING_API_URL: process.env.STAGING_API_URL ?? defaultApi,
  },
});

process.exit(result.status ?? 1);
