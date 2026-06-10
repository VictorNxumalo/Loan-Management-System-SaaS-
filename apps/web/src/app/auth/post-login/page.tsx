'use client';



import type { AuthMeResponse } from '@lms/types';

import { useSession } from 'next-auth/react';

import { useRouter } from 'next/navigation';

import { useEffect } from 'react';

import { apiFetch } from '@/lib/api';

import { getPostAuthRoute, getPostAuthRouteFromMe } from '@/lib/routes';



export default function PostLoginPage() {

  const { data: session, status } = useSession();

  const router = useRouter();



  useEffect(() => {

    if (status === 'loading') return;



    if (status === 'unauthenticated') {

      router.replace('/auth/login');

      return;

    }



    if (!session?.accessToken) return;



    let cancelled = false;



    void (async () => {

      try {

        const me = await apiFetch<AuthMeResponse>('/auth/me', {

          accessToken: session.accessToken,

        });

        if (!cancelled) {

          router.replace(getPostAuthRouteFromMe(me));

        }

      } catch {

        if (!cancelled) {

          router.replace(getPostAuthRoute(session));

        }

      }

    })();



    return () => {

      cancelled = true;

    };

  }, [status, session, router]);



  return (

    <main className="flex min-h-screen items-center justify-center">

      <p className="text-muted-foreground">Signing you in…</p>

    </main>

  );

}


