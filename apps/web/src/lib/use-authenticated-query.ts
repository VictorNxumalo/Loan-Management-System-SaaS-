'use client';

import { useSession } from 'next-auth/react';
import { useCallback, useEffect, useState } from 'react';
import { useApi } from './use-api';

export function useAuthenticatedQuery<T>(path: string | null) {
  const { data: session, status } = useSession();
  const api = useApi();
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    if (!path || status !== 'authenticated' || !session?.accessToken) {
      return null;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await api<T>(path);
      setData(result);
      return result;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed');
      setData(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, [api, path, session?.accessToken, status]);

  useEffect(() => {
    if (status === 'loading') {
      return;
    }

    if (status === 'unauthenticated' || !path) {
      setLoading(false);
      setData(null);
      return;
    }

    void refetch();
  }, [status, path, refetch]);

  useEffect(() => {
    const onFocus = () => {
      if (status === 'authenticated' && path) {
        void refetch();
      }
    };

    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [status, path, refetch]);

  return { data, error, loading, refetch, isReady: status === 'authenticated' };
}
