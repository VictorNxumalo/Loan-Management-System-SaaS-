/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@lms/types', '@lms/utils'],
};

export default nextConfig;
