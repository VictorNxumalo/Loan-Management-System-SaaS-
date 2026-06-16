/**
 * Start API + web for testing on a phone/tablet on the same Wi‑Fi.
 * Sets NEXT_PUBLIC_API_URL and NEXTAUTH_URL to this machine's LAN IP.
 *
 * Override IP: MOBILE_HOST=192.168.1.50 pnpm dev:mobile
 */
import { execSync, spawn } from 'node:child_process';
import { networkInterfaces } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const webPort = process.env.WEB_PORT ?? '3000';
const apiPort = process.env.API_PORT ?? '3001';

function getLanIp() {
  const nets = networkInterfaces();
  const candidates = [];

  for (const entries of Object.values(nets)) {
    for (const net of entries ?? []) {
      if (net.family !== 'IPv4' || net.internal) {
        continue;
      }
      candidates.push(net.address);
    }
  }

  return (
    candidates.find((ip) => ip.startsWith('192.168.')) ??
    candidates.find((ip) => ip.startsWith('10.')) ??
    candidates[0] ??
    '127.0.0.1'
  );
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForHttp(url, attempts = 60) {
  for (let i = 0; i < attempts; i += 1) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(4000) });
      if (response.ok) {
        return true;
      }
    } catch {
      // Server still starting or compiling.
    }
    await sleep(2000);
  }
  return false;
}

const host = process.env.MOBILE_HOST ?? getLanIp();
const appUrl = `http://${host}:${webPort}`;
const apiUrl = `http://${host}:${apiPort}/v1`;

const env = {
  ...process.env,
  NEXT_PUBLIC_API_URL: apiUrl,
  NEXTAUTH_URL: appUrl,
  API_PORT: apiPort,
};

console.log('');
console.log('══════════════════════════════════════════════════════════');
console.log('  LMS mobile dev — use these URLs on your phone (same Wi‑Fi)');
console.log('══════════════════════════════════════════════════════════');
console.log(`  App:         ${appUrl}`);
console.log(`  API:         ${apiUrl}`);
console.log(`  Mobile test: ${appUrl}/mobile-test  ← try this first on your phone`);
console.log('');
console.log('  IMPORTANT: Do not run "pnpm dev" at the same time.');
console.log('  Stop other dev servers first, then use only this command.');
console.log('');
console.log('  If your phone cannot connect:');
console.log('  1. Run scripts/open-dev-firewall.ps1 as Administrator');
console.log('  2. On this PC, open the App URL above once (warms compile)');
console.log('  3. Phone must be on the same Wi‑Fi (not mobile data)');
console.log('  4. Avoid guest/corporate Wi‑Fi with device isolation');
console.log('══════════════════════════════════════════════════════════');
console.log('');

execSync('node scripts/kill-dev-ports.mjs', { cwd: root, stdio: 'inherit' });
execSync('pnpm --filter @lms/types build && pnpm --filter @lms/utils build', {
  cwd: root,
  stdio: 'inherit',
  shell: true,
});

const child = spawn(
  'pnpm',
  ['--parallel', '--filter', '@lms/api', '--filter', '@lms/web', 'dev'],
  {
    cwd: root,
    env,
    stdio: 'inherit',
    shell: true,
  },
);

void (async () => {
  console.log('Waiting for dev servers (first compile can take ~30s)…');
  const ready = await waitForHttp(`${appUrl}/`);
  if (ready) {
    console.log(`\n✓ Server ready at ${appUrl}`);
    console.log('  Open that URL on this PC once, then try your phone.\n');
  } else {
    console.warn('\n⚠ Timed out waiting for server — check terminal output above.\n');
  }
})();

child.on('exit', (code) => process.exit(code ?? 0));
