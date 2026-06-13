import Link from 'next/link';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export function ActivityRow({
  href,
  title,
  subtitle,
  meta,
  trailing,
  variant = 'default',
}: {
  href: string;
  title: string;
  subtitle?: string;
  meta?: string;
  trailing?: ReactNode;
  variant?: 'default' | 'alert';
}) {
  return (
    <Link
      href={href}
      className={cn(
        'flex items-center justify-between gap-3 rounded-lg border bg-background px-4 py-3 transition',
        'hover:border-primary/35 hover:bg-accent/30 active:scale-[0.995]',
        variant === 'alert' && 'border-destructive/25 bg-destructive/[0.03]',
      )}
    >
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-foreground">{title}</p>
        {subtitle && (
          <p className="mt-0.5 truncate text-sm text-muted-foreground">{subtitle}</p>
        )}
        {meta && <p className="mt-1 text-xs text-muted-foreground">{meta}</p>}
      </div>
      {trailing && <div className="shrink-0 text-right text-sm">{trailing}</div>}
    </Link>
  );
}

export function ActivityList({ children }: { children: ReactNode }) {
  return <div className="space-y-2">{children}</div>;
}
