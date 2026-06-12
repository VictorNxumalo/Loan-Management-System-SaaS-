export type AppEnv = 'local' | 'sandbox' | 'production';

/** Hosted environment label — set on Vercel/Render per deployment. */
export function getAppEnv(): AppEnv {
  const raw = process.env.NEXT_PUBLIC_APP_ENV?.trim().toLowerCase();
  if (raw === 'sandbox' || raw === 'staging') return 'sandbox';
  if (raw === 'production' || raw === 'prod') return 'production';
  return 'local';
}

export function isSandboxDeployment(): boolean {
  return getAppEnv() === 'sandbox';
}
