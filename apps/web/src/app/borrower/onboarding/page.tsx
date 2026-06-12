'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { borrowerOnboardingSchema } from '@lms/types';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';
import { AuthShell } from '@/components/brand/auth-shell';
import { PageLoading } from '@/components/brand/loading';
import { LmsLoaderMark } from '@/components/brand/logo';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { apiFetch } from '@/lib/api';

type BorrowerOnboardingForm = z.infer<typeof borrowerOnboardingSchema>;

export default function BorrowerOnboardingPage() {
  const { data: session, status, update } = useSession();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<BorrowerOnboardingForm>({
    resolver: zodResolver(borrowerOnboardingSchema),
  });

  const onSubmit = async (data: BorrowerOnboardingForm) => {
    if (!session?.accessToken) return;
    setError(null);

    try {
      await apiFetch('/auth/borrower-onboarding', {
        method: 'PATCH',
        accessToken: session.accessToken,
        body: JSON.stringify(data),
      });

      await update();
      router.replace('/borrower');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save your profile');
    }
  };

  if (status === 'loading') {
    return <PageLoading label="Loading your profile…" className="min-h-screen" />;
  }

  return (
    <AuthShell
      title="Set up your borrower profile"
      description="Tell lenders how to reach you. You can browse public lenders and accept invites after this step."
    >
      {error && (
        <p className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive motion-safe:animate-fade-in">
          {error}
        </p>
      )}
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="phone">Phone number</Label>
          <Input id="phone" {...register('phone')} />
          {errors.phone && (
            <p className="text-sm text-destructive">{errors.phone.message}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="idNumber">ID / passport number (optional)</Label>
          <Input id="idNumber" {...register('idNumber')} />
        </div>
        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? (
            <span className="inline-flex items-center gap-2">
              <LmsLoaderMark size="sm" />
              Saving…
            </span>
          ) : (
            'Continue'
          )}
        </Button>
      </form>
    </AuthShell>
  );
}
