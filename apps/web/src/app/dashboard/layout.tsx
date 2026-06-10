'use client';

import type { AuthMeResponse } from '@lms/types';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';
import { AppShell } from '@/components/app-shell';
import { apiFetch } from '@/lib/api';
import { getPostAuthRouteFromMe } from '@/lib/routes';

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace('/auth/login');
      return;
    }

    if (status !== 'authenticated' || !session?.accessToken) return;

    let cancelled = false;

    void (async () => {
      try {
        const me = await apiFetch<AuthMeResponse>('/auth/me', {
          accessToken: session.accessToken,
        });

        if (cancelled) return;

        if (me.user.accountType === 'BORROWER') {
          router.replace(getPostAuthRouteFromMe(me));
          return;
        }

        if (!me.user.onboardingCompleted) {
          router.replace('/onboarding');
        }
      } catch {
        if (!cancelled) {
          router.replace('/auth/login');
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [status, session, router]);

  if (status === 'loading') {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">Loading…</p>
      </main>
    );
  }

  return <AppShell>{children}</AppShell>;
}
