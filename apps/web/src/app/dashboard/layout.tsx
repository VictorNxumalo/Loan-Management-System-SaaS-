'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';
import { AppShell } from '@/components/app-shell';

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace('/auth/login');
      return;
    }
    if (
      status === 'authenticated' &&
      session?.user &&
      !session.user.onboardingCompleted
    ) {
      router.replace('/onboarding');
    }
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
