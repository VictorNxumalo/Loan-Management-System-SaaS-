'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { LmsLogo } from '@/components/brand/logo';
import { NotificationBell } from '@/components/notification-bell';
import { cn } from '@/lib/utils';

export type ShellNavItem = {
  href: string;
  label: string;
  match?: 'exact' | 'prefix';
};

export function ShellHeader({
  navItems,
  trailing,
  banner,
}: {
  navItems: ShellNavItem[];
  trailing: ReactNode;
  banner?: ReactNode;
}) {
  const pathname = usePathname();

  const isActive = (item: ShellNavItem) => {
    if (item.match === 'exact') {
      return pathname === item.href;
    }
    return pathname === item.href || pathname.startsWith(`${item.href}/`);
  };

  return (
    <>
      {banner}
      <header className="sticky top-0 z-40 border-b border-border/70 bg-background/85 backdrop-blur-md supports-[backdrop-filter]:bg-background/70">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4">
          <div className="flex min-w-0 items-center gap-6">
            <LmsLogo href={navItems[0]?.href ?? '/'} size="sm" showSubtitle={false} />
            <nav className="hidden items-center gap-1 md:flex" aria-label="Main">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'rounded-md px-3 py-2 lms-nav-link',
                    isActive(item) &&
                      'bg-accent/70 font-semibold text-brand-green shadow-sm',
                  )}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
          <div className="flex shrink-0 items-center gap-2 sm:gap-3">{trailing}</div>
        </div>
        <nav
          className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-4 pb-2 md:hidden"
          aria-label="Mobile"
        >
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium transition-colors',
                isActive(item)
                  ? 'bg-brand-green text-white'
                  : 'bg-muted text-muted-foreground hover:text-foreground',
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </header>
    </>
  );
}

export function ShellUserMeta({
  name,
  subtitle,
  badges,
}: {
  name?: string | null;
  subtitle?: string | null;
  badges?: ReactNode;
}) {
  return (
    <div className="hidden text-right sm:block">
      <p className="text-sm font-medium">{name}</p>
      {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
      {badges && <div className="mt-1 flex justify-end gap-1">{badges}</div>}
    </div>
  );
}

export function ShellNotifications() {
  return <NotificationBell />;
}
