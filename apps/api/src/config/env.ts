import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1).optional(),
  JWT_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  API_PORT: z.coerce.number().default(3001),
  NEXTAUTH_URL: z.string().url().default('http://localhost:3000'),
  SENDGRID_API_KEY: z.string().optional(),
  SENDGRID_FROM_EMAIL: z.string().email().optional(),
  /** When true, new accounts are auto-verified and can sign in immediately (no SendGrid). */
  SKIP_EMAIL_VERIFICATION: z.coerce.boolean().default(true),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  CRON_OVERDUE_ENABLED: z.coerce.boolean().default(true),
  CRON_OVERDUE_SCHEDULE: z.string().default('0 6 * * *'),
  CRON_REMINDER_ENABLED: z.coerce.boolean().default(true),
  CRON_REMINDER_SCHEDULE: z.string().default('0 7 * * *'),
  TWILIO_ACCOUNT_SID: z.string().optional(),
  TWILIO_AUTH_TOKEN: z.string().optional(),
  TWILIO_FROM_NUMBER: z.string().optional(),
  AFRICASTALKING_API_KEY: z.string().optional(),
  AFRICASTALKING_USERNAME: z.string().optional(),
  SUPABASE_URL: z.string().url().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
  SUPABASE_STORAGE_BUCKET: z.string().default('lms-documents'),
  DOCUMENT_URL_EXPIRY_SECONDS: z.coerce.number().int().min(60).max(3600).default(900),
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

export function isSendGridConfigured(): boolean {
  const env = getEnv();
  return Boolean(env.SENDGRID_API_KEY && env.SENDGRID_FROM_EMAIL);
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
