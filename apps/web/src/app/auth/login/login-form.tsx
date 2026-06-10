'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { loginSchema } from '@lms/types';
import { getSession, signIn } from 'next-auth/react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { isGoogleOAuthEnabled } from '@/lib/api';

type LoginForm = z.infer<typeof loginSchema>;

export function LoginForm({ verified }: { verified: boolean }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const inviteToken = searchParams.get('inviteToken');
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginForm) => {
    setError(null);
    const result = await signIn('credentials', {
      email: data.email,
      password: data.password,
      redirect: false,
    });

    if (result?.error) {
      setError(
        result.error === 'CredentialsSignin'
          ? 'Invalid email or password.'
          : result.error === 'Failed to fetch'
            ? 'Could not reach the API. Make sure the dev server is running (port 3001).'
            : result.error,
      );
      return;
    }

    await getSession();

    router.push(
      inviteToken
        ? `/borrower/invites/accept?token=${encodeURIComponent(inviteToken)}`
        : '/auth/post-login',
    );
    router.refresh();
  };

  const googleEnabled = isGoogleOAuthEnabled();

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Sign in to LMS</CardTitle>
          <CardDescription>
            Lenders manage loans here. Borrowers sign in to browse and connect with lenders.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {verified && (
            <p className="rounded-md bg-green-50 p-3 text-sm text-green-800">
              Email verified. You can now sign in.
            </p>
          )}
          {error && (
            <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </p>
          )}
          <form
            onSubmit={(e) => void handleSubmit(onSubmit)(e)}
            method="post"
            action="#"
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" {...register('email')} />
              {errors.email && (
                <p className="text-sm text-destructive">{errors.email.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" {...register('password')} />
              {errors.password && (
                <p className="text-sm text-destructive">{errors.password.message}</p>
              )}
            </div>
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? 'Signing in…' : 'Sign in'}
            </Button>
          </form>
          {googleEnabled && (
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => signIn('google', { callbackUrl: '/dashboard' })}
            >
              Continue with Google
            </Button>
          )}
          <div className="flex justify-between text-sm">
            <Link href="/auth/register" className="text-primary hover:underline">
              Create account
            </Link>
            <Link href="/auth/reset-password" className="text-primary hover:underline">
              Forgot password?
            </Link>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
