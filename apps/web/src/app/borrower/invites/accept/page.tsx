'use client';

import { useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { useApi } from '@/lib/use-api';

export default function AcceptInvitePage() {
  const api = useApi();
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const { data: session, status } = useSession();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace(`/auth/login?inviteToken=${token ?? ''}`);
    }
  }, [status, router, token]);

  const accept = async () => {
    if (!token) {
      setError('Invite token is missing');
      return;
    }

    try {
      const result = await api<{ message: string }>('/borrower/invites/accept', {
        method: 'POST',
        body: JSON.stringify({ token }),
      });
      setMessage(result.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not accept invite');
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Accept lender invite</CardTitle>
          <CardDescription>
            Connect with a lender who invited you to LMS.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {session?.user && (
            <p className="text-sm text-muted-foreground">
              Signed in as {session.user.email}
            </p>
          )}
          {error && <p className="text-sm text-destructive">{error}</p>}
          {message && <p className="text-sm text-green-700">{message}</p>}
          <Button className="w-full" onClick={() => void accept()} disabled={!token}>
            Accept invite
          </Button>
          {message && (
            <Button variant="outline" className="w-full" onClick={() => router.push('/borrower/lenders/mine')}>
              Go to my lenders
            </Button>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
