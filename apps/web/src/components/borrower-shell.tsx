'use client';

import { signOut, useSession } from 'next-auth/react';
import type { ReactNode } from 'react';
import {
  ShellHeader,
  ShellNotifications,
  ShellUserMeta,
} from '@/components/brand/shell-header';
import { AccountTypeBadge } from '@/components/role-badge';
import { Button } from '@/components/ui/button';

export function BorrowerShell({ children }: { children: ReactNode }) {
  const { data: session } = useSession();

  const navItems = [
    { href: '/borrower', label: 'Home', match: 'exact' as const },
    { href: '/borrower/lenders/browse', label: 'Browse lenders' },
    { href: '/borrower/lenders/mine', label: 'My lenders' },
    { href: '/borrower/applications', label: 'Applications' },
    { href: '/borrower/loans', label: 'My loans' },
  ];

  return (
    <div className="min-h-screen">
      <ShellHeader
        navItems={navItems}
        trailing={
          <>
            <ShellNotifications />
            <ShellUserMeta
              name={session?.user?.name}
              badges={<AccountTypeBadge accountType="BORROWER" />}
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
