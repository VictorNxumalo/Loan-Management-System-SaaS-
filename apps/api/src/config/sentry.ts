import * as Sentry from '@sentry/nestjs';

function parseSampleRate(raw: string | undefined, fallback: number): number {
  if (raw === undefined || raw === '') return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0 || value > 1) return fallback;
  return value;
}

export function isSentryConfigured(): boolean {
  return Boolean(process.env.SENTRY_DSN?.trim());
}

export function getSentryStatus() {
  return {
    enabled: isSentryConfigured() && process.env.NODE_ENV !== 'test',
    environment:
      process.env.SENTRY_ENVIRONMENT?.trim() ||
      process.env.NODE_ENV ||
      'development',
  };
}

/** Call once from instrument.ts before NestFactory.create. */
export function initSentry(): void {
  const dsn = process.env.SENTRY_DSN?.trim();
  if (!dsn || process.env.NODE_ENV === 'test') {
    return;
  }

  Sentry.init({
    dsn,
    environment:
      process.env.SENTRY_ENVIRONMENT?.trim() ||
      process.env.NODE_ENV ||
      'development',
    release: process.env.SENTRY_RELEASE?.trim(),
    tracesSampleRate: parseSampleRate(
      process.env.SENTRY_TRACES_SAMPLE_RATE,
      0.1,
    ),
    beforeSend(event) {
      if (event.request?.headers) {
        delete event.request.headers.authorization;
        delete event.request.headers.cookie;
      }
      return event;
    },
  });
}
