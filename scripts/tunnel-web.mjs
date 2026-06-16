/**
 * Public tunnel so your phone can reach the dev server without LAN/firewall setup.
 * Uses localtunnel — URL changes each run.
 *
 * Prerequisite: pnpm dev:mobile running in another terminal.
 */
import { spawn } from 'node:child_process';
import { networkInterfaces } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const webPort = process.env.WEB_PORT ?? '3000';
const apiPort = process.env.API_PORT ?? '3001';

function getLanIp() {
  const nets = networkInterfaces();
  for (const entries of Object.values(nets)) {
    for (const net of entries ?? []) {
      if (net.family === 'IPv4' && !net.internal && net.address.startsWith('192.168.')) {
        return net.address;
      }
    }
  }
  return '127.0.0.1';
}

console.log('');
console.log('Starting public tunnel to localhost:' + webPort);
console.log('Keep "pnpm dev:mobile" running in another terminal.');
console.log('');
console.log('When the tunnel URL appears, you must also set on the dev:mobile terminal:');
console.log('  Stop dev:mobile, then restart with:');
console.log('  set NEXTAUTH_URL=<tunnel-url>');
console.log('  set NEXT_PUBLIC_API_URL=<tunnel-url>:3001/v1  (API still local — see note)');
console.log('');
console.log('For tunnel-only web testing, use the /mobile-test page first.');
console.log('');

const child = spawn(
  'npx',
  ['localtunnel', '--port', webPort, '--local-host', '127.0.0.1'],
  { cwd: root, stdio: 'inherit', shell: true },
);

child.on('exit', (code) => process.exit(code ?? 0));
