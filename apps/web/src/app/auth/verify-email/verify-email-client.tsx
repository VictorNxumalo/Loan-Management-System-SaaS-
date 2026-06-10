'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { apiFetch } from '@/lib/api';

export function VerifyEmailClient({ token }: { token: string | null }) {
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setMessage('Verification token is missing.');
      return;
    }

    apiFetch<{ message: string }>(`/auth/verify-email?token=${encodeURIComponent(token)}`)
      .then((result) => {
        setStatus('success');
        setMessage(result.message);
      })
      .catch((err: Error) => {
        setStatus('error');
        setMessage(err.message);
      });
  }, [token]);

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md text-center">
        <CardHeader>
          <CardTitle>Email verification</CardTitle>
          <CardDescription>
            {status === 'loading' && 'Verifying your email…'}
            {status === 'success' && 'Verification complete'}
            {status === 'error' && 'Verification failed'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">{message}</p>
          {status === 'success' && (
            <Button asChild>
              <Link href="/auth/login?verified=1">Continue to sign in</Link>
            </Button>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
