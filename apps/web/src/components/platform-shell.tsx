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
import { PlatformOperatorBadge } from '@/components/role-badge';

export function PlatformShell({ children }: { children: ReactNode }) {
  const { data: session } = useSession();

  const navItems = [
    { href: '/platform', label: 'Overview', shortLabel: 'Overview', match: 'exact' as const },
    {
      href: '/platform/support',
      label: 'User issues',
      shortLabel: 'Issues',
    },
    {
      href: '/platform/compliance',
      label: 'Lender compliance',
      shortLabel: 'Compliance',
    },
  ];

  const banner = (
    <div className="border-b border-violet-200/80 bg-violet-50 px-4 py-2.5 text-center text-sm text-violet-950 motion-safe:animate-slide-down">
      LMS platform operator console — manage lender trust and user support requests.
    </div>
  );

  return (
    <div className="min-h-screen">
      <ShellHeader
        navItems={navItems}
        banner={banner}
        userMeta={
          <ShellUserMeta
            name={session?.user?.name}
            subtitle="LMS Platform Operations"
          />
        }
        drawerUserMeta={
          <ShellDrawerUser
            name={session?.user?.name}
            subtitle="LMS Platform Operations"
            badges={<PlatformOperatorBadge />}
          />
        }
        actions={
          <>
            <Link
              href="/dashboard/profile"
              className="hidden text-sm text-muted-foreground hover:text-foreground sm:inline"
            >
              Profile
            </Link>
            <ShellLogoutButton onClick={() => signOut({ callbackUrl: '/auth/login' })} />
          </>
        }
      />
      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8 motion-safe:animate-fade-in">
        {children}
      </main>
    </div>
  );
}
