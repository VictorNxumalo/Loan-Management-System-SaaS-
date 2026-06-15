'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { loginSchema } from '@lms/types';
import { getSession, signIn } from 'next-auth/react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';
import { AuthShell } from '@/components/brand/auth-shell';
import { LmsLoaderMark } from '@/components/brand/logo';
import { LegalFooterLinks } from '@/components/legal/legal-consent-notice';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { apiFetch, isGoogleOAuthEnabled } from '@/lib/api';

type LoginForm = z.infer<typeof loginSchema>;

export function LoginForm({ verified }: { verified: boolean }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const inviteToken = searchParams.get('inviteToken');
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  });

  const emailValue = watch('email');
  const needsVerification = error?.toLowerCase().includes('verify your email');
  const [resendMessage, setResendMessage] = useState<string | null>(null);
  const [resending, setResending] = useState(false);

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

  const handleResendVerification = async () => {
    if (!emailValue) {
      setResendMessage('Enter your email address first.');
      return;
    }
    setResendMessage(null);
    setResending(true);
    try {
      const result = await apiFetch<{ message: string }>('/auth/resend-verification', {
        method: 'POST',
        body: JSON.stringify({ email: emailValue }),
      });
      setResendMessage(result.message);
    } catch (err) {
      setResendMessage(
        err instanceof Error ? err.message : 'Could not resend verification email',
      );
    } finally {
      setResending(false);
    }
  };

  const googleEnabled = isGoogleOAuthEnabled();

  return (
    <AuthShell
      title="Sign in to LMS"
      description="Lenders manage loans here. Borrowers sign in to browse and connect with lenders."
    >
      {verified && (
        <p className="mb-4 rounded-md border border-brand-green/30 bg-brand-green/10 p-3 text-sm text-brand-green motion-safe:animate-fade-in">
          Email verified. You can now sign in.
        </p>
      )}
      {error && (
        <div className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive motion-safe:animate-fade-in">
          <p>{error}</p>
          {needsVerification && (
            <div className="mt-3 space-y-2 text-foreground">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={resending}
                onClick={() => void handleResendVerification()}
              >
                {resending ? 'Sending…' : 'Resend verification email'}
              </Button>
              {resendMessage && <p className="text-sm">{resendMessage}</p>}
            </div>
          )}
        </div>
      )}
      <form
        onSubmit={(e) => void handleSubmit(onSubmit)(e)}
        method="post"
        action="#"
        className="space-y-4"
      >
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" autoComplete="email" {...register('email')} />
          {errors.email && (
            <p className="text-sm text-destructive">{errors.email.message}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            {...register('password')}
          />
          {errors.password && (
            <p className="text-sm text-destructive">{errors.password.message}</p>
          )}
        </div>
        <Button type="submit" className="w-full shadow-md shadow-brand-green/20" disabled={isSubmitting}>
          {isSubmitting ? (
            <span className="flex items-center justify-center gap-2">
              <LmsLoaderMark size="sm" />
              Signing in…
            </span>
          ) : (
            'Sign in'
          )}
        </Button>
      </form>
      {googleEnabled && (
        <Button
          type="button"
          variant="outline"
          className="mt-4 w-full"
          onClick={() => signIn('google', { callbackUrl: '/dashboard' })}
        >
          Continue with Google
        </Button>
      )}
      <div className="mt-6 flex justify-between text-sm">
        <Link href="/auth/register" className="font-medium text-brand-green hover:underline">
          Create account
        </Link>
        <Link href="/auth/reset-password" className="text-muted-foreground hover:text-foreground hover:underline">
          Forgot password?
        </Link>
      </div>
      <div className="mt-4">
        <LegalFooterLinks />
      </div>
    </AuthShell>
  );
}
