import Link from 'next/link';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/** Consistent page title + actions that stack on small screens. */
export function PageHeader({
  title,
  description,
  actions,
  backHref,
  backLabel,
  className,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  backHref?: string;
  backLabel?: string;
  className?: string;
}) {
  return (
    <div className={cn('space-y-3', className)}>
      {backHref && (
        <Link
          href={backHref}
          className="inline-flex text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          ← {backLabel ?? 'Back'}
        </Link>
      )}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl font-bold tracking-tight text-brand-navy sm:text-2xl">
            {title}
          </h1>
          {description && (
            <div className="mt-1 text-sm text-muted-foreground sm:text-base">{description}</div>
          )}
        </div>
        {actions && (
          <div className="flex w-full shrink-0 flex-wrap gap-2 sm:w-auto sm:justify-end">
            {actions}
          </div>
        )}
      </div>
    </div>
  );
}
