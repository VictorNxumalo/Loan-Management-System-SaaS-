'use client';

import { signOut, useSession } from 'next-auth/react';
import type { ReactNode } from 'react';
import {
  ShellDrawerUser,
  ShellHeader,
  ShellLogoutButton,
  ShellUserMeta,
} from '@/components/brand/shell-header';
import { AccountTypeBadge } from '@/components/role-badge';

export function BorrowerShell({ children }: { children: ReactNode }) {
  const { data: session } = useSession();

  const navItems = [
    { href: '/borrower', label: 'Overview', shortLabel: 'Overview', match: 'exact' as const },
    { href: '/borrower/lenders/mine', label: 'My lenders', shortLabel: 'Lenders' },
    { href: '/borrower/applications', label: 'Applications', shortLabel: 'Apps' },
    { href: '/borrower/loans', label: 'My loans', shortLabel: 'Loans' },
    { href: '/borrower/wallet', label: 'Wallet' },
    {
      href: '/borrower/lenders/browse',
      label: 'Browse lenders',
      shortLabel: 'Browse',
      secondary: true,
    },
    { href: '/borrower/profile', label: 'Profile', secondary: true },
  ];

  return (
    <div className="min-h-screen">
      <ShellHeader
        navItems={navItems}
        userMeta={<ShellUserMeta name={session?.user?.name} />}
        drawerUserMeta={
          <ShellDrawerUser
            name={session?.user?.name}
            badges={<AccountTypeBadge accountType="BORROWER" />}
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
