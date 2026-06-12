/** API base URL — read at call time so Vercel server routes get runtime env vars. */
export function getApiBaseUrl(): string {
  const url =
    process.env.API_URL ??
    process.env.NEXT_PUBLIC_API_URL ??
    'http://localhost:3001/v1';
  return url.replace(/\/$/, '');
}
