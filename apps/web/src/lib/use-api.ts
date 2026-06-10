'use client';

import { useSession } from 'next-auth/react';
import { useCallback } from 'react';
import { apiFetch } from './api';

export function useApi() {
  const { data: session } = useSession();
  const accessToken = session?.accessToken;

  return useCallback(
    <T,>(path: string, options: RequestInit = {}) =>
      apiFetch<T>(path, { ...options, accessToken }),
    [accessToken],
  );
}
