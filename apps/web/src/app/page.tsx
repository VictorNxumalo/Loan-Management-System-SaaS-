import Link from 'next/link';
import {
  ArrowRight,
  BarChart3,
  Handshake,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { LmsIcon, LmsLogo } from '@/components/brand/logo';
import { MarketingShell } from '@/components/brand/auth-shell';
import { Reveal, StaggerGroup } from '@/components/brand/reveal';
import { Button } from '@/components/ui/button';

const VALUE_PROPS = [
  {
    icon: ShieldCheck,
    title: 'Trust & security',
    text: 'Tenant isolation, audit trails, and structured review workflows.',
  },
  {
    icon: Handshake,
    title: 'Connection',
    text: 'Borrowers and lenders meet in an ordered, transparent marketplace.',
  },
  {
    icon: BarChart3,
    title: 'Growth',
    text: 'Portfolio dashboards, schedules, repayments, and arrears visibility.',
  },
];

export default function HomePage() {
  return (
    <MarketingShell>
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <LmsLogo href="/" size="md" showSubtitle />
          <div className="flex items-center gap-2">
            <Button variant="ghost" asChild>
              <Link href="/auth/login">Sign in</Link>
            </Button>
            <Button asChild className="shadow-md shadow-brand-green/20">
              <Link href="/auth/register?type=lender">Get started</Link>
            </Button>
          </div>
        </div>
      </header>

      <section className="relative overflow-hidden px-4 pb-16 pt-14 sm:pb-24 sm:pt-20">
        <div className="pointer-events-none absolute -left-32 top-10 h-72 w-72 rounded-full bg-brand-green/10 blur-3xl motion-safe:animate-float" />
        <div className="pointer-events-none absolute -right-24 bottom-0 h-80 w-80 rounded-full bg-brand-navy/5 blur-3xl" />

        <div className="relative mx-auto max-w-6xl">
          <Reveal>
            <div className="mx-auto max-w-3xl text-center">
              <p className="inline-flex items-center gap-2 rounded-full border border-brand-green/25 bg-brand-green/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-brand-green">
                <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                Loan Management System
              </p>
              <h1 className="mt-6 text-4xl font-bold tracking-tight text-brand-navy sm:text-5xl lg:text-6xl">
                Connect lenders and borrowers{' '}
                <span className="lms-gradient-text">in one place</span>
              </h1>
              <p className="mt-5 text-lg text-muted-foreground sm:text-xl">
                A modern platform for evidence-based applications, structured reviews,
                repayment tracking, and an orderly lending marketplace.
              </p>
              <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
                <Button size="lg" asChild className="shadow-lg shadow-brand-green/25">
                  <Link href="/auth/register?type=lender">
                    I lend money
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
                <Button size="lg" variant="secondary" asChild>
                  <Link href="/auth/register?type=borrower">I want to borrow</Link>
                </Button>
              </div>
            </div>
          </Reveal>

          <Reveal delay={150} className="mt-14 flex justify-center">
            <div className="lms-surface max-w-4xl overflow-hidden p-2 shadow-xl shadow-brand-navy/5 motion-safe:animate-float">
              <ImageHero />
            </div>
          </Reveal>
        </div>
      </section>

      <section className="border-y border-border/70 bg-card/50 px-4 py-16">
        <div className="mx-auto max-w-6xl">
          <Reveal className="mb-10 text-center">
            <h2 className="text-2xl font-bold text-brand-navy sm:text-3xl">
              Built for clarity, connection, and growth
            </h2>
            <p className="mt-3 text-muted-foreground">
              Everything you need to run or join a lending relationship — without the
              spreadsheet chaos.
            </p>
          </Reveal>

          <StaggerGroup
            className="grid gap-6 md:grid-cols-3"
            staggerMs={120}
          >
            {VALUE_PROPS.map(({ icon: Icon, title, text }) => (
              <article key={title} className="lms-surface-interactive p-6">
                <div className="mb-4 inline-flex rounded-lg bg-brand-green/10 p-3 text-brand-green">
                  <Icon className="h-6 w-6" aria-hidden="true" />
                </div>
                <h3 className="text-lg font-semibold text-brand-navy">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{text}</p>
              </article>
            ))}
          </StaggerGroup>
        </div>
      </section>

      <section className="px-4 py-16">
        <Reveal className="mx-auto max-w-6xl">
          <div className="grid gap-6 lg:grid-cols-2">
            <AudienceCard
              title="I lend money"
              description="Run a lending workspace: manage borrowers, review applications with checklists, create loans, track repayments, and monitor your portfolio."
              cta="Create lender account"
              href="/auth/register?type=lender"
              primary
            />
            <AudienceCard
              title="I want to borrow"
              description="Browse categorised lenders, connect with organisations, submit documented applications, and track your loans in one portal."
              cta="Create borrower account"
              href="/auth/register?type=borrower"
            />
          </div>
        </Reveal>
      </section>

      <footer className="border-t border-border/70 px-4 py-8 text-center text-sm text-muted-foreground">
        <p className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
          <span>© {new Date().getFullYear()} LMS · Loan Management System</span>
          <span aria-hidden="true">·</span>
          <Link href="/legal/terms" className="hover:text-foreground hover:underline">
            Terms
          </Link>
          <span aria-hidden="true">·</span>
          <Link href="/legal/privacy" className="hover:text-foreground hover:underline">
            Privacy
          </Link>
        </p>
      </footer>
    </MarketingShell>
  );
}

function ImageHero() {
  return (
    <div className="rounded-lg bg-gradient-to-br from-brand-navy to-brand-navy/90 p-8 sm:p-12 text-white">
      <div className="grid gap-8 sm:grid-cols-2 sm:items-center">
        <div className="flex flex-col items-start gap-4">
          <LmsIcon variant="monochrome" size="lg" className="rounded-2xl shadow-lg shadow-black/20" />
          <div>
            <p className="text-sm font-medium text-brand-green">Platform preview</p>
            <p className="mt-2 text-2xl font-bold leading-snug">
              From application to repayment — one connected journey.
            </p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {['Applications', 'Loans', 'Repayments', 'Marketplace'].map((label, index) => (
            <div
              key={label}
              className="rounded-lg border border-white/10 bg-white/5 px-4 py-5 text-center text-sm font-medium backdrop-blur-sm motion-safe:animate-fade-up motion-reduce:opacity-100"
              style={{ animationDelay: `${index * 100}ms` }}
            >
              {label}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function AudienceCard({
  title,
  description,
  cta,
  href,
  primary = false,
}: {
  title: string;
  description: string;
  cta: string;
  href: string;
  primary?: boolean;
}) {
  return (
    <article className="lms-surface-interactive flex flex-col p-8">
      <h3 className="text-xl font-semibold text-brand-navy">{title}</h3>
      <p className="mt-3 flex-1 text-sm leading-relaxed text-muted-foreground">
        {description}
      </p>
      <Button
        asChild
        variant={primary ? 'default' : 'outline'}
        className="mt-6 w-fit"
      >
        <Link href={href}>{cta}</Link>
      </Button>
    </article>
  );
}
