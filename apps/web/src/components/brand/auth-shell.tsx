import type { ReactNode } from 'react';
import Link from 'next/link';
import { LmsLogo } from '@/components/brand/logo';
import { cn } from '@/lib/utils';

export function AuthShell({
  children,
  title,
  description,
}: {
  children: ReactNode;
  title: string;
  description?: string;
}) {
  return (
    <main className="relative flex min-h-screen flex-col lg:flex-row">
      <div className="relative hidden overflow-hidden bg-brand-navy px-10 py-12 text-white lg:flex lg:w-[42%] lg:flex-col lg:justify-between">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,hsl(var(--brand-green)/0.25),transparent_55%)]" />
        <div className="absolute -right-20 top-1/3 h-64 w-64 rounded-full bg-brand-green/10 blur-3xl motion-safe:animate-float" />
        <div className="relative z-10">
          <LmsLogo size="lg" variant="monochrome" showSubtitle inverted />
        </div>
        <div className="relative z-10 space-y-6 motion-safe:animate-fade-up">
          <h1 className="text-3xl font-bold leading-tight tracking-tight xl:text-4xl">
            Connect lenders and borrowers in one place.
          </h1>
          <ul className="space-y-4 text-sm text-white/75">
            <ValuePoint icon="🛡️" text="Trust & security with tenant isolation and audit trails" />
            <ValuePoint icon="📈" text="Growth-focused portfolio tools and repayment tracking" />
            <ValuePoint icon="🔗" text="Structured connections between verified parties" />
          </ul>
        </div>
        <p className="relative z-10 text-xs text-white/50">
          Loan Management System · Built for South African lending workflows ·{' '}
          <Link href="/legal/terms" className="underline underline-offset-2 hover:text-white/70">
            Terms
          </Link>
          {' · '}
          <Link href="/legal/privacy" className="underline underline-offset-2 hover:text-white/70">
            Privacy
          </Link>
        </p>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center px-4 py-10 lg:px-8">
        <div className="mb-8 lg:hidden">
          <LmsLogo href="/" size="md" variant="colored" showSubtitle />
        </div>
        <div className="w-full max-w-md motion-safe:animate-scale-in">
          <div className="mb-6 text-center lg:text-left">
            <h2 className="text-2xl font-bold tracking-tight text-brand-navy">{title}</h2>
            {description && (
              <p className="mt-2 text-sm text-muted-foreground">{description}</p>
            )}
          </div>
          <div className="lms-surface p-6 shadow-md">{children}</div>
        </div>
      </div>
    </main>
  );
}

function ValuePoint({ icon, text }: { icon: string; text: string }) {
  return (
    <li className="flex items-start gap-3">
      <span className="mt-0.5 text-base" aria-hidden="true">
        {icon}
      </span>
      <span>{text}</span>
    </li>
  );
}

export function MarketingShell({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('relative min-h-screen overflow-x-hidden', className)}>{children}</div>
  );
}
