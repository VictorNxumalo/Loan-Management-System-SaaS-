'use client';

import { useSession } from 'next-auth/react';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';
import { BorrowerShell } from '@/components/borrower-shell';

export default function BorrowerLayout({ children }: { children: ReactNode }) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace('/auth/login');
      return;
    }

    if (status === 'authenticated' && session?.user?.accountType !== 'BORROWER') {
      router.replace('/dashboard');
      return;
    }

    const onboardingExempt =
      pathname.startsWith('/borrower/onboarding') ||
      pathname.startsWith('/borrower/invites');

    if (
      status === 'authenticated' &&
      session?.user?.accountType === 'BORROWER' &&
      !session.user.onboardingCompleted &&
      !onboardingExempt
    ) {
      router.replace('/borrower/onboarding');
    }
  }, [status, session, router, pathname]);

  if (
    status === 'loading' ||
    (session?.user?.accountType === 'BORROWER' &&
      !session.user.onboardingCompleted &&
      !pathname.startsWith('/borrower/onboarding') &&
      !pathname.startsWith('/borrower/invites'))
  ) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">Loading…</p>
      </main>
    );
  }

  const minimalRoute =
    pathname.startsWith('/borrower/onboarding') ||
    pathname.startsWith('/borrower/invites');

  if (minimalRoute) {
    return <>{children}</>;
  }

  return <BorrowerShell>{children}</BorrowerShell>;
}
