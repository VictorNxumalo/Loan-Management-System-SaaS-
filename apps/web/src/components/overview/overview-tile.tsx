import type { LucideIcon } from 'lucide-react';
import { ChevronRight } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

type OverviewTileVariant = 'default' | 'alert' | 'muted';

export function OverviewTile({
  href,
  title,
  description,
  value,
  icon: Icon,
  variant = 'default',
  footer,
}: {
  href: string;
  title: string;
  description: string;
  value: string;
  icon: LucideIcon;
  variant?: OverviewTileVariant;
  footer?: ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(
        'group relative flex min-h-[8.5rem] flex-col rounded-xl border bg-card p-4 transition-all',
        'lms-surface-interactive touch-manipulation active:scale-[0.99]',
        variant === 'alert' && 'border-destructive/35 bg-destructive/[0.04]',
        variant === 'muted' && 'bg-muted/20',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div
          className={cn(
            'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg',
            variant === 'alert'
              ? 'bg-destructive/10 text-destructive'
              : 'bg-brand-green/10 text-brand-green',
          )}
        >
          <Icon className="h-4 w-4" aria-hidden="true" />
        </div>
        <ChevronRight
          className="h-4 w-4 shrink-0 text-muted-foreground/50 transition group-hover:text-primary motion-safe:group-hover:translate-x-0.5"
          aria-hidden="true"
        />
      </div>
      <p className="mt-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </p>
      <p
        className={cn(
          'mt-1 text-xl font-bold tracking-tight sm:text-2xl',
          variant === 'alert' ? 'text-destructive' : 'text-brand-green',
        )}
      >
        {value}
      </p>
      <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
        {description}
      </p>
      {footer && <div className="mt-2">{footer}</div>}
    </Link>
  );
}

export function OverviewTileGrid({ children }: { children: ReactNode }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 xl:grid-cols-4">
      {children}
    </div>
  );
}
