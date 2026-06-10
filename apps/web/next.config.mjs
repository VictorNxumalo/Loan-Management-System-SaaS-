import dotenv from 'dotenv';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

// Load shared monorepo .env (Next.js only reads apps/web by default)
dotenv.config({ path: join(dirname(fileURLToPath(import.meta.url)), '../../.env') });

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@lms/types', '@lms/utils'],
};

export default nextConfig;
