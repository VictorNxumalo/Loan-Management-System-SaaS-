import dotenv from 'dotenv';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { withSentryConfig } from '@sentry/nextjs';

// Load shared monorepo .env (Next.js only reads apps/web by default)
dotenv.config({ path: join(dirname(fileURLToPath(import.meta.url)), '../../.env') });

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@lms/types', '@lms/utils'],
  experimental: {
    instrumentationHook: true,
  },
};

const sentryEnabled = Boolean(
  process.env.SENTRY_DSN?.trim() || process.env.NEXT_PUBLIC_SENTRY_DSN?.trim(),
);

export default sentryEnabled
  ? withSentryConfig(nextConfig, {
      silent: true,
      disableLogger: true,
      tunnelRoute: '/monitoring',
      widenClientFileUpload: true,
    })
  : nextConfig;
