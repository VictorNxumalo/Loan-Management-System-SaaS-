'use client';

import type { AuthMeResponse } from '@lms/types';
import { useSession } from 'next-auth/react';
import { useAuthenticatedQuery } from './use-authenticated-query';

/** Platform operator flag from /auth/me (API env), with session fallback. */
export function useIsPlatformAdmin(): boolean {
  const { data: session } = useSession();
  const { data: me } = useAuthenticatedQuery<AuthMeResponse>(
    session?.accessToken ? '/auth/me' : null,
  );

  if (me?.user?.isPlatformAdmin === true) {
    return true;
  }

  return session?.user?.isPlatformAdmin === true;
}
