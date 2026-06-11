'use client';

import { signOut, useSession } from 'next-auth/react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { AccountTypeBadge, RoleBadge } from '@/components/role-badge';
import { NotificationBell } from '@/components/notification-bell';
import { Button } from '@/components/ui/button';
import { canManageSettings } from '@/lib/permissions';

export function AppShell({ children }: { children: ReactNode }) {
  const { data: session } = useSession();
  const role = session?.user?.role ?? undefined;
  const showSettings = canManageSettings(role);

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="border-b bg-background">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
          <div className="flex items-center gap-6">
            <Link href="/dashboard" className="font-semibold">
              LMS
            </Link>
            <nav className="hidden gap-4 text-sm text-muted-foreground sm:flex">
              <Link href="/dashboard" className="hover:text-foreground">
                Dashboard
              </Link>
              <Link href="/dashboard/borrowers" className="hover:text-foreground">
                People I lend to
              </Link>
              <Link href="/dashboard/loans" className="hover:text-foreground">
                Loans
              </Link>
              <Link href="/dashboard/applications" className="hover:text-foreground">
                Applications
              </Link>
              {showSettings && (
                <>
                  <Link href="/dashboard/team" className="hover:text-foreground">
                    Team
                  </Link>
                  <Link href="/dashboard/audit-log" className="hover:text-foreground">
                    Audit log
                  </Link>
                  <Link href="/dashboard/settings" className="hover:text-foreground">
                    Settings
                  </Link>
                </>
              )}
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <NotificationBell />
            <div className="hidden text-right sm:block">
              <p className="text-sm font-medium">{session?.user?.name}</p>
              <p className="text-xs text-muted-foreground">
                {session?.organisation?.name}
              </p>
              <div className="mt-1 flex justify-end gap-1">
                <AccountTypeBadge accountType={session?.user?.accountType} />
                <RoleBadge role={role} />
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
