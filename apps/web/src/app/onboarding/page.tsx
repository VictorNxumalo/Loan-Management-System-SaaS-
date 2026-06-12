'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { InterestType, onboardingSchema, type AuthMeResponse } from '@lms/types';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';
import { AuthShell } from '@/components/brand/auth-shell';
import { PageLoading } from '@/components/brand/loading';
import { LmsLoaderMark } from '@/components/brand/logo';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { apiFetch } from '@/lib/api';
import { isLenderAccount } from '@/lib/routes';

type OnboardingForm = z.infer<typeof onboardingSchema>;

export default function OnboardingPage() {
  const { data: session, status, update } = useSession();
  const router = useRouter();
  const [pageReady, setPageReady] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<OnboardingForm>({
    resolver: zodResolver(onboardingSchema),
    defaultValues: {
      defaultCurrency: 'ZAR',
      defaultInterestType: InterestType.REDUCING,
    },
  });

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace('/auth/login');
      return;
    }

    if (status !== 'authenticated' || !session?.accessToken) return;

    let cancelled = false;

    void (async () => {
      try {
        const me = await apiFetch<AuthMeResponse>('/auth/me', {
          accessToken: session.accessToken,
        });

        if (cancelled) return;

        if (me.user.accountType === 'BORROWER') {
          router.replace(
            me.user.onboardingCompleted ? '/borrower' : '/borrower/onboarding',
          );
          return;
        }

        if (me.user.onboardingCompleted) {
          router.replace('/dashboard');
          return;
        }

        if (isLenderAccount(me)) {
          setPageReady(true);
        }
      } catch {
        if (!cancelled) {
          router.replace('/auth/login');
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [status, session, router]);

  const onSubmit = async (data: OnboardingForm) => {
    if (!session?.accessToken) return;

    await apiFetch('/auth/onboarding', {
      method: 'PATCH',
      accessToken: session.accessToken,
      body: JSON.stringify(data),
    });

    await update();
    router.push('/dashboard');
  };

  if (status === 'loading' || !pageReady) {
    return <PageLoading label="Preparing your workspace…" className="min-h-screen" />;
  }

  return (
    <AuthShell
      title="Set up your lending workspace"
      description="You are creating an organisation that lends money. Borrowers you lend to appear under People I lend to — they only log in if they create a separate borrower account."
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="organisationName">Organisation name</Label>
          <Input id="organisationName" {...register('organisationName')} />
          {errors.organisationName && (
            <p className="text-sm text-destructive">{errors.organisationName.message}</p>
          )}
        </div>

        <div className="rounded-lg border border-dashed border-brand-navy/15 bg-brand-gray/50 p-6 text-center text-sm text-muted-foreground">
          Logo upload — coming in Phase 6
        </div>

        <div className="space-y-2">
          <Label htmlFor="defaultCurrency">Default currency (ISO 4217)</Label>
          <Input id="defaultCurrency" maxLength={3} {...register('defaultCurrency')} />
          {errors.defaultCurrency && (
            <p className="text-sm text-destructive">{errors.defaultCurrency.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="defaultInterestType">Default interest method</Label>
          <select
            id="defaultInterestType"
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-green/40"
            {...register('defaultInterestType')}
          >
            <option value={InterestType.FLAT}>Flat rate</option>
            <option value={InterestType.REDUCING}>Reducing balance</option>
          </select>
          {errors.defaultInterestType && (
            <p className="text-sm text-destructive">{errors.defaultInterestType.message}</p>
          )}
        </div>

        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? (
            <span className="inline-flex items-center gap-2">
              <LmsLoaderMark size="sm" />
              Saving…
            </span>
          ) : (
            'Complete setup'
          )}
        </Button>
      </form>
    </AuthShell>
  );
}
