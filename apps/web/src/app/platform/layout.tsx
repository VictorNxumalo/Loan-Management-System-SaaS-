'use client';

import type { AuthMeResponse } from '@lms/types';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';
import { PlatformShell } from '@/components/platform-shell';
import { PageLoading } from '@/components/brand/loading';
import { apiFetch } from '@/lib/api';
import { getPostAuthRouteFromMe } from '@/lib/routes';

export default function PlatformLayout({ children }: { children: ReactNode }) {
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

        if (!me.user.isPlatformAdmin) {
          router.replace(getPostAuthRouteFromMe(me));
          return;
        }

        if (!me.user.profileComplete) {
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
    return <PageLoading label="Loading platform console…" className="min-h-screen" />;
  }

  return <PlatformShell>{children}</PlatformShell>;
}
