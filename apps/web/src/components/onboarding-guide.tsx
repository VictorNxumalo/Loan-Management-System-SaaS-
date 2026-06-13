'use client';

import { CheckCircle2, Circle } from 'lucide-react';
import { cn } from '@/lib/utils';

const LENDER_STEPS = [
  {
    title: 'Create your workspace',
    detail: 'Name your organisation, upload a logo, and choose default loan settings.',
  },
  {
    title: 'Verify identity',
    detail: 'Enter your SA ID number, residential address, and upload a clear ID document.',
  },
  {
    title: 'Link your bank account',
    detail: 'Connect the account used for wallet disbursements and repayments.',
  },
  {
    title: 'After onboarding',
    detail:
      'Invite your team, review borrower applications, activate approved loans, and disburse funds from your dashboard.',
  },
] as const;

const BORROWER_STEPS = [
  {
    title: 'Contact & identity',
    detail: 'Add your phone number, SA ID, and residential address.',
  },
  {
    title: 'Upload ID document',
    detail: 'Upload a readable copy of your green ID book or smart ID card.',
  },
  {
    title: 'Link your bank account',
    detail: 'This account receives loan disbursements and is used for repayments.',
  },
  {
    title: 'After onboarding',
    detail:
      'Browse lenders in the marketplace, submit documented applications, and track approvals, disbursements, and repayments from your overview.',
  },
] as const;

export function SignUpGuide({ accountType }: { accountType: 'LENDER' | 'BORROWER' }) {
  const steps = accountType === 'LENDER' ? LENDER_STEPS : BORROWER_STEPS;

  return (
    <aside className="rounded-lg border border-brand-green/20 bg-brand-green/5 p-4 text-sm">
      <p className="font-semibold text-brand-navy">
        {accountType === 'LENDER' ? 'First-time lender guide' : 'First-time borrower guide'}
      </p>
      <p className="mt-1 text-muted-foreground">
        After you create your account and sign in, you&apos;ll complete a one-time onboarding
        flow. Here&apos;s what to expect:
      </p>
      <ol className="mt-3 space-y-2">
        {steps.map((step, index) => (
          <li key={step.title} className="flex gap-2">
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-green/15 text-xs font-semibold text-brand-green">
              {index + 1}
            </span>
            <span>
              <span className="font-medium text-foreground">{step.title}</span>
              <span className="text-muted-foreground"> — {step.detail}</span>
            </span>
          </li>
        ))}
      </ol>
    </aside>
  );
}

export function OnboardingStepGuide({
  variant,
  step,
}: {
  variant: 'lender' | 'borrower';
  step: number;
}) {
  const steps = variant === 'lender' ? LENDER_STEPS : BORROWER_STEPS;
  const current = steps[Math.min(Math.max(step, 1), 3) - 1] ?? steps[0];

  return (
    <div className="mb-6 rounded-lg border bg-muted/30 p-4 text-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Step {step} of 3 · Getting started
      </p>
      <p className="mt-1 font-medium text-brand-navy">{current.title}</p>
      <p className="mt-1 text-muted-foreground">{current.detail}</p>
      <ul className="mt-3 flex flex-wrap gap-2">
        {steps.slice(0, 3).map((item, index) => {
          const stepNumber = index + 1;
          const done = step > stepNumber;
          const active = step === stepNumber;
          return (
            <li
              key={item.title}
              className={cn(
                'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs',
                active && 'bg-brand-green/15 font-medium text-brand-navy',
                done && 'text-muted-foreground',
                !active && !done && 'text-muted-foreground/70',
              )}
            >
              {done ? (
                <CheckCircle2 className="h-3.5 w-3.5 text-brand-green" aria-hidden="true" />
              ) : (
                <Circle className="h-3.5 w-3.5" aria-hidden="true" />
              )}
              {item.title}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
