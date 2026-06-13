import Link from 'next/link';
import type { ReactNode } from 'react';

export function OverviewSection({
  title,
  description,
  href,
  hrefLabel = 'View all',
  children,
}: {
  title: string;
  description?: string;
  href?: string;
  hrefLabel?: string;
  children: ReactNode;
}) {
  return (
    <section className="lms-surface overflow-hidden">
      <div className="flex items-start justify-between gap-3 border-b bg-muted/30 px-4 py-3 sm:items-center sm:px-5">
        <div className="min-w-0">
          <h2 className="font-semibold text-brand-navy">{title}</h2>
          {description && (
            <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
          )}
        </div>
        {href && (
          <Link
            href={href}
            className="shrink-0 rounded-md px-2 py-1 text-sm font-medium text-primary hover:bg-accent hover:underline"
          >
            {hrefLabel}
          </Link>
        )}
      </div>
      <div className="p-4 sm:p-5">{children}</div>
    </section>
  );
}

export function OverviewEmptyState({ message }: { message: string }) {
  return <p className="text-sm text-muted-foreground">{message}</p>;
}
