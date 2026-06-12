'use client';

import type { ReactNode } from 'react';
import { LmsLoaderMark } from '@/components/brand/logo';
import { cn } from '@/lib/utils';

export function LmsLoader({
  label = 'Loading',
  size = 'md',
  className,
}: {
  label?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  return (
    <div
      className={cn('flex flex-col items-center justify-center gap-3', className)}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <LmsLoaderMark size={size} />
      {label && (
        <p className="text-sm font-medium text-muted-foreground motion-safe:animate-pulse">
          {label}
        </p>
      )}
    </div>
  );
}

export function PageLoading({
  label = 'Loading',
  className,
}: {
  label?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex min-h-[40vh] flex-col items-center justify-center gap-4 motion-safe:animate-fade-in',
        className,
      )}
    >
      <LmsLoader label={label} size="lg" />
    </div>
  );
}

export function InlineLoading({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex items-center gap-3 py-6 motion-safe:animate-fade-in">
      <LmsLoaderMark size="sm" />
      <span className="text-sm text-muted-foreground">{label}</span>
    </div>
  );
}

export function LoadingOverlay({ label = 'Loading' }: { label?: string }) {
  return (
    <div className="absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-background/70 backdrop-blur-[2px]">
      <LmsLoader label={label} size="md" />
    </div>
  );
}

export function AsyncContent({
  loading,
  error,
  loadingLabel = 'Loading',
  empty,
  children,
}: {
  loading: boolean;
  error?: string | null;
  loadingLabel?: string;
  empty?: ReactNode;
  children: ReactNode;
}) {
  if (loading) {
    return <PageLoading label={loadingLabel} />;
  }

  if (error) {
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive motion-safe:animate-fade-in">
        {error}
      </div>
    );
  }

  if (empty) {
    return <>{empty}</>;
  }

  return (
    <div className="motion-safe:animate-fade-up">{children}</div>
  );
}
