import type { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface';
import { getEnv } from './env';

const VERCEL_PREVIEW_ORIGIN = /^https:\/\/[a-z0-9-]+\.vercel\.app$/i;

/** Production/staging CORS — dev allows all origins in main.ts. */
export function getCorsOptions(): CorsOptions {
  const env = getEnv();

  if (env.NODE_ENV === 'development') {
    return { origin: true, credentials: true };
  }

  const allowed = new Set<string>([env.NEXTAUTH_URL]);
  if (env.CORS_ORIGINS) {
    for (const origin of env.CORS_ORIGINS.split(',')) {
      const trimmed = origin.trim();
      if (trimmed) allowed.add(trimmed);
    }
  }

  return {
    credentials: true,
    origin(origin, callback) {
      if (!origin) {
        callback(null, true);
        return;
      }
      if (allowed.has(origin)) {
        callback(null, true);
        return;
      }
      if (env.STAGING_ALLOW_VERCEL_CORS && VERCEL_PREVIEW_ORIGIN.test(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error(`Origin ${origin} not allowed by CORS`));
    },
  };
}
