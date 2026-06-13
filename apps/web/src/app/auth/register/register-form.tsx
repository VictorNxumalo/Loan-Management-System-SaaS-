'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { registerSchema } from '@lms/types';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';
import { AuthShell } from '@/components/brand/auth-shell';
import { LmsLoaderMark } from '@/components/brand/logo';
import { SignUpGuide } from '@/components/onboarding-guide';
import { LegalConsentNotice } from '@/components/legal/legal-consent-notice';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { apiFetch } from '@/lib/api';

type RegisterFormValues = z.infer<typeof registerSchema>;

export function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const inviteToken = searchParams.get('invite');
  const initialType =
    searchParams.get('type') === 'borrower' ? 'BORROWER' : 'LENDER';
  const [accountType, setAccountType] = useState<'LENDER' | 'BORROWER'>(
    inviteToken ? 'LENDER' : initialType,
  );
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { accountType: inviteToken ? 'LENDER' : initialType },
  });

  const onSubmit = async (data: RegisterFormValues) => {
    setError(null);
    setMessage(null);
    try {
      const result = await apiFetch<{ message: string }>('/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          ...data,
          accountType,
          ...(inviteToken ? { inviteToken } : {}),
        }),
      });
      setMessage(result.message);
      setTimeout(
        () =>
          router.push(
            accountType === 'BORROWER'
              ? '/auth/login?type=borrower'
              : '/auth/login?type=lender',
          ),
        2000,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    }
  };

  return (
    <AuthShell
      title={inviteToken ? 'Join your team' : 'Create your account'}
      description={
        inviteToken
          ? 'You have been invited to join a lending workspace. Use the email the invite was sent to.'
          : 'Choose whether you are setting up a lending workspace or a borrower profile.'
      }
    >
      <div className="space-y-4">
        {!inviteToken && (
          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant={accountType === 'LENDER' ? 'default' : 'outline'}
              onClick={() => setAccountType('LENDER')}
            >
              I lend money
            </Button>
            <Button
              type="button"
              variant={accountType === 'BORROWER' ? 'default' : 'outline'}
              onClick={() => setAccountType('BORROWER')}
            >
              I want to borrow
            </Button>
          </div>
        )}

        {!inviteToken && <SignUpGuide accountType={accountType} />}

        {message && (
          <p className="rounded-md border border-brand-green/30 bg-brand-green/10 p-3 text-sm text-brand-green motion-safe:animate-fade-in">
            {message}
          </p>
        )}
        {error && (
          <p className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive motion-safe:animate-fade-in">
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
            <Label htmlFor="name">Full name</Label>
            <Input id="name" {...register('name')} />
            {errors.name && (
              <p className="text-sm text-destructive">{errors.name.message}</p>
            )}
          </div>
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
            {isSubmitting ? (
              <span className="inline-flex items-center gap-2">
                <LmsLoaderMark size="sm" />
                Creating account…
              </span>
            ) : inviteToken ? (
              'Join team'
            ) : (
              'Create account'
            )}
          </Button>
          <LegalConsentNotice />
        </form>
        <p className="text-center text-sm">
          Already have an account?{' '}
          <Link href="/auth/login" className="font-medium text-brand-green hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </AuthShell>
  );
}
