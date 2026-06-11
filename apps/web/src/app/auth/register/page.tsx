'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { registerSchema } from '@lms/types';
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
import { apiFetch } from '@/lib/api';

type RegisterForm = z.infer<typeof registerSchema>;

export default function RegisterPage() {
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
  } = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
    defaultValues: { accountType: inviteToken ? 'LENDER' : initialType },
  });

  const onSubmit = async (data: RegisterForm) => {
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
    <main className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>
            {inviteToken ? 'Join your team' : 'Create your account'}
          </CardTitle>
          <CardDescription>
            {inviteToken
              ? 'You have been invited to join a lending workspace. Use the email the invite was sent to.'
              : 'Choose whether you are setting up a lending workspace or a borrower profile.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
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

          {message && (
            <p className="rounded-md bg-green-50 p-3 text-sm text-green-800">{message}</p>
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
              {isSubmitting
                ? 'Creating account…'
                : inviteToken
                  ? 'Join team'
                  : 'Create account'}
            </Button>
          </form>
          <p className="text-center text-sm">
            Already have an account?{' '}
            <Link href="/auth/login" className="text-primary hover:underline">
              Sign in
            </Link>
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
