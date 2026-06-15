import './load-env';
import { z } from 'zod';

/** Render/other hosts sometimes set blank env vars; treat as unset for optional fields. */
const optionalString = z.preprocess(
  (val) => (val === '' || val === undefined ? undefined : val),
  z.string().optional(),
);

const optionalUrl = z.preprocess(
  (val) => (val === '' || val === undefined ? undefined : val),
  z.string().url().optional(),
);

/** Parse env booleans — z.coerce.boolean() treats the string "false" as true. */
const envBoolean = (defaultValue: boolean) =>
  z.preprocess(
    (val) => {
      if (val === undefined || val === '') return defaultValue;
      if (val === true || val === 'true' || val === '1') return true;
      if (val === false || val === 'false' || val === '0') return false;
      return val;
    },
    z.boolean(),
  );

const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: optionalString,
  JWT_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  /** Hosting platforms (Render, Railway) set PORT; API_PORT is the local fallback. */
  API_PORT: z.preprocess(
    (val) => (val === undefined || val === '' ? process.env.PORT : val),
    z.coerce.number().default(3001),
  ),
  NEXTAUTH_URL: z.string().url().default('http://localhost:3000'),
  /** Comma-separated extra browser origins allowed by CORS (staging preview URLs, etc.) */
  CORS_ORIGINS: optionalString,
  /** Staging only: allow any https://*.vercel.app origin (preview deploys) */
  STAGING_ALLOW_VERCEL_CORS: envBoolean(false),
  /** Brevo transactional email — https://app.brevo.com/settings/keys/api */
  BREVO_API_KEY: optionalString,
  BREVO_FROM_EMAIL: z.preprocess(
    (val) => (val === '' || val === undefined ? undefined : val),
    z.string().email().optional(),
  ),
  BREVO_FROM_NAME: z.string().default('LMS'),
  /** When true, new accounts are auto-verified and can sign in immediately (no email provider). */
  SKIP_EMAIL_VERIFICATION: envBoolean(true),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  CRON_OVERDUE_ENABLED: envBoolean(true),
  CRON_OVERDUE_SCHEDULE: z.string().default('0 6 * * *'),
  CRON_REMINDER_ENABLED: envBoolean(true),
  CRON_REMINDER_SCHEDULE: z.string().default('0 7 * * *'),
  TWILIO_ACCOUNT_SID: z.string().optional(),
  TWILIO_AUTH_TOKEN: z.string().optional(),
  TWILIO_FROM_NUMBER: z.string().optional(),
  AFRICASTALKING_API_KEY: z.string().optional(),
  AFRICASTALKING_USERNAME: z.string().optional(),
  SUPABASE_URL: optionalUrl,
  SUPABASE_SERVICE_ROLE_KEY: optionalString,
  SUPABASE_STORAGE_BUCKET: z.string().default('lms-documents'),
  DOCUMENT_URL_EXPIRY_SECONDS: z.coerce.number().int().min(60).max(3600).default(900),
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  STRIPE_PRICE_STARTER: z.string().optional(),
  STRIPE_PRICE_PRO: z.string().optional(),
  STRIPE_PRICE_BUSINESS: z.string().optional(),
  TRIAL_DAYS: z.coerce.number().int().min(1).max(90).default(14),
  /** Stitch — SA disbursements + LinkPay (https://docs.stitch.money) */
  STITCH_CLIENT_ID: optionalString,
  STITCH_CLIENT_SECRET: optionalString,
  STITCH_WEBHOOK_SECRET: optionalString,
  /** When true, loan Disburse uses Stitch payout to borrower bank (requires float + credentials). */
  STITCH_DISBURSEMENTS_ENABLED: envBoolean(false),
  STITCH_API_BASE: z.string().url().default('https://api.stitch.money/v2'),
  STITCH_TOKEN_URL: z
    .string()
    .url()
    .default('https://secure.stitch.money/connect/token'),
  /** SA repo rate (% p.a.) for NCA maximum interest cap calculation */
  NCR_REPO_RATE_PERCENT: z.coerce.number().positive().max(30).default(8.25),
});

export type Env = z.infer<typeof envSchema>;

let cached: Env | null = null;

export function getEnv(): Env {
  if (!cached) {
    const result = envSchema.safeParse(process.env);
    if (!result.success) {
      const formatted = result.error.issues
        .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
        .join('\n');
      throw new Error(`Invalid environment configuration:\n${formatted}`);
    }
    cached = result.data;
  }
  return cached;
}

export function isBrevoConfigured(): boolean {
  const env = getEnv();
  return Boolean(env.BREVO_API_KEY && env.BREVO_FROM_EMAIL);
}

export function isGoogleOAuthConfigured(): boolean {
  const env = getEnv();
  return Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);
}

export function isEmailVerificationSkipped(): boolean {
  return getEnv().SKIP_EMAIL_VERIFICATION;
}

export function isTwilioConfigured(): boolean {
  const env = getEnv();
  return Boolean(
    env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN && env.TWILIO_FROM_NUMBER,
  );
}

export function isAfricasTalkingConfigured(): boolean {
  const env = getEnv();
  return Boolean(env.AFRICASTALKING_API_KEY && env.AFRICASTALKING_USERNAME);
}

export function isSmsConfigured(): boolean {
  return isAfricasTalkingConfigured() || isTwilioConfigured();
}

export function isSupabaseStorageConfigured(): boolean {
  const env = getEnv();
  return Boolean(env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY);
}

export function getDocumentUrlExpirySeconds(): number {
  return getEnv().DOCUMENT_URL_EXPIRY_SECONDS;
}

export function isStripeConfigured(): boolean {
  const env = getEnv();
  return Boolean(
    env.STRIPE_SECRET_KEY &&
      env.STRIPE_PRICE_STARTER &&
      env.STRIPE_PRICE_PRO &&
      env.STRIPE_PRICE_BUSINESS,
  );
}

export function getTrialDays(): number {
  return getEnv().TRIAL_DAYS;
}

export function isStitchConfigured(): boolean {
  const env = getEnv();
  return Boolean(env.STITCH_CLIENT_ID && env.STITCH_CLIENT_SECRET);
}

export function isStitchDisbursementsEnabled(): boolean {
  return isStitchConfigured() && getEnv().STITCH_DISBURSEMENTS_ENABLED;
}

export function getStitchApiBaseUrl(): string {
  return getEnv().STITCH_API_BASE.replace(/\/$/, '');
}

export function getStitchTokenUrl(): string {
  return getEnv().STITCH_TOKEN_URL;
}

export function getNcrRepoRatePercent(): number {
  return getEnv().NCR_REPO_RATE_PERCENT;
}
