import Link from 'next/link';
import type { ReactNode } from 'react';
import { LmsIcon } from '@/components/brand/logo';
import { Reveal } from '@/components/brand/reveal';
import { Button } from '@/components/ui/button';

export function EmptyState({
  title,
  description,
  actionLabel,
  actionHref,
  action,
}: {
  title: string;
  description: string;
  actionLabel?: string;
  actionHref?: string;
  action?: ReactNode;
}) {
  return (
    <Reveal>
      <div className="lms-surface border-dashed px-6 py-12 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-green/10 p-2">
          <LmsIcon variant="colored" size="sm" className="opacity-80" />
        </div>
        <h3 className="text-lg font-semibold text-brand-navy">{title}</h3>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">{description}</p>
        {action}
        {!action && actionLabel && actionHref && (
          <Button asChild className="mt-6 shadow-md shadow-brand-green/20">
            <Link href={actionHref}>{actionLabel}</Link>
          </Button>
        )}
      </div>
    </Reveal>
  );
}
