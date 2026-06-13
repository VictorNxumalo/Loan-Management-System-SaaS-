'use client';

import { useSession } from 'next-auth/react';
import { useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import type { BillingStatusDto } from '@lms/types';
import { OrganisationPlan } from '@lms/types';
import { CardSkeleton } from '@/components/brand/skeleton';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { canManageSettings } from '@/lib/permissions';
import { useApi } from '@/lib/use-api';

const PLAN_OPTIONS = [
  {
    id: OrganisationPlan.STARTER,
    name: 'Starter',
    description: 'Up to 50 active loans, 1 team member',
  },
  {
    id: OrganisationPlan.PRO,
    name: 'Pro',
    description: 'Up to 500 active loans, up to 5 team members',
  },
  {
    id: OrganisationPlan.BUSINESS,
    name: 'Business',
    description: 'Unlimited loans, up to 20 team members',
  },
];

export default function BillingPage() {
  const api = useApi();
  const { data: session, update } = useSession();
  const searchParams = useSearchParams();
  const isAdmin = canManageSettings(session?.user?.role ?? undefined);

  const [status, setStatus] = useState<BillingStatusDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const loadStatus = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await api<BillingStatusDto>('/billing/status');
      setStatus(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load billing status');
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    if (session?.accessToken && isAdmin) {
      void loadStatus();
    }
  }, [session?.accessToken, isAdmin, loadStatus]);

  useEffect(() => {
    const checkout = searchParams.get('checkout');
    if (checkout === 'success') {
      setMessage('Subscription updated. It may take a moment to reflect here.');
      void update();
      void loadStatus();
    } else if (checkout === 'cancelled') {
      setMessage('Checkout was cancelled.');
    }
  }, [searchParams, update, loadStatus]);

  const startCheckout = async (plan: string) => {
    setBusy(plan);
    setError(null);
    try {
      const result = await api<{ url: string }>('/billing/checkout', {
        method: 'POST',
        body: JSON.stringify({ plan }),
      });
      window.location.href = result.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start checkout');
      setBusy(null);
    }
  };

  const openPortal = async () => {
    setBusy('portal');
    setError(null);
    try {
      const result = await api<{ url: string }>('/billing/portal-url');
      window.location.href = result.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not open billing portal');
      setBusy(null);
    }
  };

  if (!isAdmin) {
    return (
      <p className="text-sm text-muted-foreground">
        Only admins can manage billing.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Billing"
        description={`Manage your subscription and workspace limits for ${session?.organisation?.name}.`}
      />

      {error && <p className="text-sm text-destructive">{error}</p>}
      {message && <p className="text-sm text-green-700">{message}</p>}

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2">
          <CardSkeleton rows={4} />
          <CardSkeleton rows={5} />
        </div>
      ) : status ? (
        <>
          {status.isReadOnly && (
            <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              Your workspace is in <strong>read-only</strong> mode. You can view data but
              cannot make changes until you subscribe to a plan.
            </div>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Current plan</CardTitle>
              <CardDescription>
                Status: {status.planStatus.replace(/_/g, ' ').toLowerCase()}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <p>
                <span className="font-medium">{status.planLabel}</span> plan
              </p>
              {status.trialDaysRemaining != null && (
                <p className="text-muted-foreground">
                  Trial: {status.trialDaysRemaining} day(s) remaining
                  {status.trialEndsAt
                    ? ` (ends ${new Date(status.trialEndsAt).toLocaleDateString()})`
                    : ''}
                </p>
              )}
              {status.currentPeriodEnd && (
                <p className="text-muted-foreground">
                  Current billing period ends{' '}
                  {new Date(status.currentPeriodEnd).toLocaleDateString()}
                </p>
              )}
              <p className="text-muted-foreground">
                Usage: {status.limits.activeLoans}
                {status.limits.maxActiveLoans != null
                  ? ` / ${status.limits.maxActiveLoans}`
                  : ''}{' '}
                active loans · {status.limits.users}
                {status.limits.maxUsers != null ? ` / ${status.limits.maxUsers}` : ''} team
                members
              </p>
              {status.subscriptionStatus && (
                <p className="text-muted-foreground">
                  Stripe subscription: {status.subscriptionStatus.toLowerCase()}
                </p>
              )}
              {!status.isStripeConfigured && (
                <p className="text-amber-700">
                  Stripe is not fully configured in this environment. Add STRIPE_SECRET_KEY
                  and price IDs to .env to enable checkout.
                </p>
              )}
              {status.isStripeConfigured && status.subscriptionStatus && (
                <Button
                  variant="outline"
                  disabled={busy === 'portal'}
                  onClick={() => void openPortal()}
                >
                  {busy === 'portal' ? 'Opening…' : 'Manage subscription in Stripe'}
                </Button>
              )}
            </CardContent>
          </Card>

          {status.isStripeConfigured && (
            <Card>
              <CardHeader>
                <CardTitle>Choose a plan</CardTitle>
                <CardDescription>
                  Subscribe via Stripe Checkout. Upgrade or downgrade anytime in the billing
                  portal.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-3">
                {PLAN_OPTIONS.map((plan) => (
                  <div key={plan.id} className="rounded-lg border p-4 space-y-3">
                    <div>
                      <p className="font-semibold">{plan.name}</p>
                      <p className="text-xs text-muted-foreground">{plan.description}</p>
                    </div>
                    <Button
                      className="w-full"
                      variant={status.plan === plan.id ? 'secondary' : 'default'}
                      disabled={busy === plan.id || status.plan === plan.id}
                      onClick={() => void startCheckout(plan.id)}
                    >
                      {busy === plan.id
                        ? 'Redirecting…'
                        : status.plan === plan.id
                          ? 'Current plan'
                          : `Subscribe to ${plan.name}`}
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </>
      ) : null}
    </div>
  );
}
