/**
 * Generate random secrets for sandbox (or production) env setup.
 * Does not write files — paste output into Render/Vercel dashboards.
 */
import { randomBytes } from 'node:crypto';

function secret(bytes = 32) {
  return randomBytes(bytes).toString('base64url');
}

console.log('Paste into sandbox Render + Vercel (NOT production):\n');
console.log(`JWT_SECRET=${secret()}`);
console.log(`JWT_REFRESH_SECRET=${secret()}`);
console.log(`NEXTAUTH_SECRET=${secret()}`);
