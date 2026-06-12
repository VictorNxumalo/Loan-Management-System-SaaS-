'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { forgotPasswordSchema, resetPasswordSchema } from '@lms/types';
import Link from 'next/link';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';
import { AuthShell } from '@/components/brand/auth-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { apiFetch } from '@/lib/api';

type ForgotForm = z.infer<typeof forgotPasswordSchema>;
type ResetForm = z.infer<typeof resetPasswordSchema>;

export function ResetPasswordForm({ token }: { token: string | null }) {
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const forgotForm = useForm<ForgotForm>({
    resolver: zodResolver(forgotPasswordSchema),
  });

  const resetForm = useForm<ResetForm>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { token: token ?? '' },
  });

  const onForgot = async (data: ForgotForm) => {
    setError(null);
    try {
      const result = await apiFetch<{ message: string }>('/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify(data),
      });
      setMessage(result.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed');
    }
  };

  const onReset = async (data: ResetForm) => {
    setError(null);
    try {
      const result = await apiFetch<{ message: string }>('/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify(data),
      });
      setMessage(result.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Reset failed');
    }
  };

  return (
    <AuthShell
      title={token ? 'Set new password' : 'Reset password'}
      description={
        token
          ? 'Enter your new password below'
          : 'We will send you a reset link by email'
      }
    >
      {message && (
        <p className="mb-4 rounded-md border border-brand-green/30 bg-brand-green/10 p-3 text-sm text-brand-green motion-safe:animate-fade-in">
          {message}
        </p>
      )}
      {error && (
        <p className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive motion-safe:animate-fade-in">
          {error}
        </p>
      )}

      {token ? (
        <form onSubmit={resetForm.handleSubmit(onReset)} className="space-y-4">
          <input type="hidden" {...resetForm.register('token')} />
          <div className="space-y-2">
            <Label htmlFor="password">New password</Label>
            <Input id="password" type="password" {...resetForm.register('password')} />
            {resetForm.formState.errors.password && (
              <p className="text-sm text-destructive">
                {resetForm.formState.errors.password.message}
              </p>
            )}
          </div>
          <Button type="submit" className="w-full">
            Reset password
          </Button>
        </form>
      ) : (
        <form onSubmit={forgotForm.handleSubmit(onForgot)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" {...forgotForm.register('email')} />
            {forgotForm.formState.errors.email && (
              <p className="text-sm text-destructive">
                {forgotForm.formState.errors.email.message}
              </p>
            )}
          </div>
          <Button type="submit" className="w-full">
            Send reset link
          </Button>
        </form>
      )}

      <p className="mt-4 text-center text-sm">
        <Link href="/auth/login" className="font-medium text-brand-green hover:underline">
          Back to sign in
        </Link>
      </p>
    </AuthShell>
  );
}
