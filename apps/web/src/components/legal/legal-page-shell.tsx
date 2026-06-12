import Link from 'next/link';
import type { ReactNode } from 'react';
import { LmsLogo } from '@/components/brand/logo';
import { MarketingShell } from '@/components/brand/auth-shell';
import { cn } from '@/lib/utils';

export function LegalPageShell({
  title,
  description,
  children,
  active,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  active: 'terms' | 'privacy';
}) {
  return (
    <MarketingShell>
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-4xl items-center justify-between gap-4 px-4 sm:px-6">
          <LmsLogo href="/" size="sm" showSubtitle={false} />
          <nav className="flex shrink-0 items-center gap-3 text-sm">
            <LegalNavLink href="/legal/terms" active={active === 'terms'}>
              Terms
            </LegalNavLink>
            <LegalNavLink href="/legal/privacy" active={active === 'privacy'}>
              Privacy
            </LegalNavLink>
            <Link
              href="/auth/login"
              className="hidden font-medium text-brand-green hover:underline sm:inline"
            >
              Sign in
            </Link>
          </nav>
        </div>
      </header>

      <article className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-14">
        <header className="mb-10 border-b border-border/70 pb-8">
          <h1 className="text-3xl font-bold tracking-tight text-brand-navy sm:text-4xl">
            {title}
          </h1>
          {description && (
            <p className="mt-3 max-w-2xl text-muted-foreground">{description}</p>
          )}
        </header>
        <div className="legal-prose">{children}</div>
      </article>

      <footer className="border-t border-border/70 px-4 py-8 text-center text-sm text-muted-foreground">
        <p className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
          <Link href="/" className="hover:text-foreground hover:underline">
            Home
          </Link>
          <span aria-hidden="true">·</span>
          <Link href="/legal/terms" className="hover:text-foreground hover:underline">
            Terms of Service
          </Link>
          <span aria-hidden="true">·</span>
          <Link href="/legal/privacy" className="hover:text-foreground hover:underline">
            Privacy Policy
          </Link>
        </p>
      </footer>
    </MarketingShell>
  );
}

function LegalNavLink({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(
        'rounded-md px-2 py-1 transition-colors',
        active
          ? 'bg-accent/70 font-semibold text-brand-navy'
          : 'text-muted-foreground hover:text-foreground',
      )}
      aria-current={active ? 'page' : undefined}
    >
      {children}
    </Link>
  );
}

export function LegalSection({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24">
      <h2>{title}</h2>
      {children}
    </section>
  );
}
