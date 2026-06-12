'use client';

import { signOut, useSession } from 'next-auth/react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import {
  ShellHeader,
  ShellNotifications,
  ShellUserMeta,
} from '@/components/brand/shell-header';
import { AccountTypeBadge, RoleBadge } from '@/components/role-badge';
import { Button } from '@/components/ui/button';
import { canManageSettings } from '@/lib/permissions';

export function AppShell({ children }: { children: ReactNode }) {
  const { data: session } = useSession();
  const role = session?.user?.role ?? undefined;
  const showSettings = canManageSettings(role);
  const planStatus = session?.organisation?.planStatus;
  const isReadOnly = planStatus === 'READ_ONLY' || planStatus === 'CANCELLED';

  const navItems = [
    { href: '/dashboard', label: 'Dashboard', match: 'exact' as const },
    { href: '/dashboard/borrowers', label: 'People I lend to' },
    { href: '/dashboard/loans', label: 'Loans' },
    { href: '/dashboard/applications', label: 'Applications' },
    ...(showSettings
      ? [
          { href: '/dashboard/billing', label: 'Billing' },
          { href: '/dashboard/team', label: 'Team' },
          { href: '/dashboard/audit-log', label: 'Audit log' },
          { href: '/dashboard/settings', label: 'Settings' },
        ]
      : []),
  ];

  const banner = isReadOnly ? (
    <div className="border-b border-amber-200/80 bg-amber-50 px-4 py-2.5 text-center text-sm text-amber-950 motion-safe:animate-slide-down">
      This workspace is read-only.{' '}
      {showSettings ? (
        <Link href="/dashboard/billing" className="font-semibold text-brand-green hover:underline">
          Subscribe on the Billing page
        </Link>
      ) : (
        'Ask your admin to subscribe to a plan.'
      )}{' '}
      to continue making changes.
    </div>
  ) : null;

  return (
    <div className="min-h-screen">
      <ShellHeader
        navItems={navItems}
        banner={banner}
        trailing={
          <>
            <ShellNotifications />
            <ShellUserMeta
              name={session?.user?.name}
              subtitle={session?.organisation?.name}
              badges={
                <>
                  <AccountTypeBadge accountType={session?.user?.accountType} />
                  <RoleBadge role={role} />
                </>
              }
            />
            <Button
              variant="outline"
              size="sm"
              className="border-brand-navy/15 hover:border-brand-green/40 hover:bg-accent"
              onClick={() => signOut({ callbackUrl: '/auth/login' })}
            >
              Log out
            </Button>
          </>
        }
      />
      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8 motion-safe:animate-fade-in">
        {children}
      </main>
    </div>
  );
}
