'use client';

import { signOut, useSession } from 'next-auth/react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import {
  ShellDrawerUser,
  ShellHeader,
  ShellLogoutButton,
  ShellUserMeta,
} from '@/components/brand/shell-header';
import { AccountTypeBadge, PlatformOperatorBadge, RoleBadge } from '@/components/role-badge';
import { canManageSettings } from '@/lib/permissions';
import { useIsPlatformAdmin } from '@/lib/use-platform-admin';

export function AppShell({ children }: { children: ReactNode }) {
  const { data: session } = useSession();
  const role = session?.user?.role ?? undefined;
  const showSettings = canManageSettings(role);
  const isPlatformAdmin = useIsPlatformAdmin();
  const planStatus = session?.organisation?.planStatus;
  const isReadOnly = planStatus === 'READ_ONLY' || planStatus === 'CANCELLED';

  const navItems = [
    { href: '/dashboard', label: 'Overview', shortLabel: 'Overview', match: 'exact' as const },
    ...(isPlatformAdmin
      ? [
          {
            href: '/dashboard/platform/compliance',
            label: 'Lender compliance',
            shortLabel: 'Compliance',
          },
        ]
      : []),
    { href: '/dashboard/borrowers', label: 'People I lend to', shortLabel: 'Borrowers' },
    { href: '/dashboard/loans', label: 'Loans' },
    { href: '/dashboard/wallet', label: 'Wallet' },
    { href: '/dashboard/applications', label: 'Applications', shortLabel: 'Apps' },
    { href: '/dashboard/profile', label: 'Profile', secondary: true },
    ...(showSettings
      ? [
          { href: '/dashboard/billing', label: 'Billing', secondary: true },
          { href: '/dashboard/team', label: 'Team', secondary: true },
          { href: '/dashboard/audit-log', label: 'Audit log', shortLabel: 'Audit', secondary: true },
          { href: '/dashboard/settings', label: 'Settings', secondary: true },
        ]
      : []),
  ];

  const userBadges = (
    <>
      {isPlatformAdmin ? <PlatformOperatorBadge /> : null}
      <AccountTypeBadge accountType={session?.user?.accountType} />
      <RoleBadge role={role} />
    </>
  );

  const banner = isPlatformAdmin ? (
    <div className="border-b border-brand-green/20 bg-brand-green/5 px-4 py-2.5 text-center text-sm text-brand-green motion-safe:animate-slide-down">
      Platform operator mode — review and verify lenders on the{' '}
      <Link
        href="/dashboard/platform/compliance"
        className="font-semibold underline underline-offset-2"
      >
        Lender compliance
      </Link>{' '}
      page.
    </div>
  ) : isReadOnly ? (
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
        userMeta={
          <ShellUserMeta
            name={session?.user?.name}
            subtitle={session?.organisation?.name}
          />
        }
        drawerUserMeta={
          <ShellDrawerUser
            name={session?.user?.name}
            subtitle={session?.organisation?.name}
            badges={userBadges}
          />
        }
        actions={
          <ShellLogoutButton onClick={() => signOut({ callbackUrl: '/auth/login' })} />
        }
      />
      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8 motion-safe:animate-fade-in">
        {children}
      </main>
    </div>
  );
}
