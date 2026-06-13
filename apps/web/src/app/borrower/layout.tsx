'use client';

import type { AuthMeResponse } from '@lms/types';
import { useSession } from 'next-auth/react';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { PageLoading } from '@/components/brand/loading';
import { BorrowerShell } from '@/components/borrower-shell';
import { apiFetch } from '@/lib/api';
import { getPostAuthRouteFromMe } from '@/lib/routes';

export default function BorrowerLayout({ children }: { children: ReactNode }) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const [profileChecked, setProfileChecked] = useState(false);

  const onboardingExempt =
    pathname.startsWith('/borrower/onboarding') ||
    pathname.startsWith('/borrower/invites');

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace('/auth/login');
      return;
    }

    if (status !== 'authenticated' || !session?.accessToken) {
      return;
    }

    if (session.user?.accountType !== 'BORROWER') {
      router.replace('/dashboard');
      return;
    }

    let cancelled = false;

    void (async () => {
      try {
        const me = await apiFetch<AuthMeResponse>('/auth/me', {
          accessToken: session.accessToken,
        });

        if (cancelled) {
          return;
        }

        const destination = getPostAuthRouteFromMe(me);

        if (!me.user.profileComplete && !onboardingExempt) {
          router.replace('/borrower/onboarding');
        } else if (me.user.profileComplete && pathname.startsWith('/borrower/onboarding')) {
          router.replace('/borrower');
        } else if (
          !onboardingExempt &&
          destination !== pathname &&
          destination.startsWith('/borrower/onboarding')
        ) {
          router.replace(destination);
        }

        setProfileChecked(true);
      } catch {
        if (!cancelled) {
          router.replace('/auth/login');
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [status, session, router, pathname, onboardingExempt]);

  if (status === 'loading' || (status === 'authenticated' && !profileChecked)) {
    return <PageLoading label="Loading your portal…" className="min-h-screen" />;
  }

  if (minimalRoute(pathname)) {
    return <>{children}</>;
  }

  return <BorrowerShell>{children}</BorrowerShell>;
}

function minimalRoute(pathname: string) {
  return (
    pathname.startsWith('/borrower/onboarding') ||
    pathname.startsWith('/borrower/invites')
  );
}
