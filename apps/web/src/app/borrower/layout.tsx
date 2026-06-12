'use client';

import { useSession } from 'next-auth/react';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';
import { PageLoading } from '@/components/brand/loading';
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
    return <PageLoading label="Loading your portal…" className="min-h-screen" />;
  }

  const minimalRoute =
    pathname.startsWith('/borrower/onboarding') ||
    pathname.startsWith('/borrower/invites');

  if (minimalRoute) {
    return <>{children}</>;
  }

  return <BorrowerShell>{children}</BorrowerShell>;
}
