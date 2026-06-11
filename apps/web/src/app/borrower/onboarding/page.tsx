'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { borrowerOnboardingSchema } from '@lms/types';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
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
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">Loading…</p>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle>Set up your borrower profile</CardTitle>
          <CardDescription>
            Tell lenders how to reach you. You can browse public lenders and accept invites
            after this step.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error && <p className="mb-4 text-sm text-destructive">{error}</p>}
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
              {isSubmitting ? 'Saving…' : 'Continue'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
