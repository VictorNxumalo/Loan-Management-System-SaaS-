import type { ErrorEvent, EventHint } from '@sentry/nextjs';

function parseSampleRate(raw: string | undefined, fallback: number): number {
  if (raw === undefined || raw === '') return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0 || value > 1) return fallback;
  return value;
}

export function getSentryDsn(): string | undefined {
  return (
    process.env.SENTRY_DSN?.trim() ||
    process.env.NEXT_PUBLIC_SENTRY_DSN?.trim() ||
    undefined
  );
}

export function isSentryEnabled(): boolean {
  return Boolean(getSentryDsn()) && process.env.NODE_ENV !== 'test';
}

function scrubSensitiveHeaders(event: ErrorEvent): ErrorEvent {
  if (event.request?.headers) {
    delete event.request.headers.authorization;
    delete event.request.headers.cookie;
  }
  return event;
}

export function getSharedSentryOptions() {
  return {
    dsn: getSentryDsn(),
    environment:
      process.env.SENTRY_ENVIRONMENT?.trim() ||
      process.env.NEXT_PUBLIC_APP_ENV?.trim() ||
      process.env.NODE_ENV ||
      'development',
    release: process.env.SENTRY_RELEASE?.trim(),
    tracesSampleRate: parseSampleRate(
      process.env.SENTRY_TRACES_SAMPLE_RATE,
      0.1,
    ),
    enabled: isSentryEnabled(),
    beforeSend(event: ErrorEvent, _hint: EventHint) {
      return scrubSensitiveHeaders(event);
    },
  };
}
