'use client';

import { signOut, useSession } from 'next-auth/react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { AccountTypeBadge } from '@/components/role-badge';
import { Button } from '@/components/ui/button';

export function BorrowerShell({ children }: { children: ReactNode }) {
  const { data: session } = useSession();

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="border-b bg-background">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
          <div className="flex items-center gap-6">
            <Link href="/borrower" className="font-semibold">
              LMS
            </Link>
            <nav className="hidden gap-4 text-sm text-muted-foreground sm:flex">
              <Link href="/borrower" className="hover:text-foreground">
                Home
              </Link>
              <Link href="/borrower/lenders/browse" className="hover:text-foreground">
                Browse lenders
              </Link>
              <Link href="/borrower/lenders/mine" className="hover:text-foreground">
                My lenders
              </Link>
              <Link href="/borrower/applications" className="hover:text-foreground">
                My applications
              </Link>
              <Link href="/borrower/loans" className="hover:text-foreground">
                My loans
              </Link>
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-medium">{session?.user?.name}</p>
              <div className="mt-1 flex justify-end">
                <AccountTypeBadge accountType="BORROWER" />
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => signOut({ callbackUrl: '/auth/login' })}
            >
              Log out
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl p-6">{children}</main>
    </div>
  );
}
