import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 p-8">
      <div className="max-w-2xl text-center">
        <h1 className="text-4xl font-bold tracking-tight">LMS</h1>
        <p className="mt-3 text-lg text-muted-foreground">
          Loan Management System — connect lenders and borrowers in one place.
        </p>
      </div>

      <div className="grid w-full max-w-3xl gap-4 md:grid-cols-2">
        <section className="rounded-lg border bg-background p-6">
          <h2 className="text-xl font-semibold">I lend money</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Run a lending workspace: manage people you lend to, create loans, track
            repayments, and monitor your portfolio.
          </p>
          <Button asChild className="mt-4">
            <Link href="/auth/register?type=lender">Create lender account</Link>
          </Button>
        </section>

        <section className="rounded-lg border bg-background p-6">
          <h2 className="text-xl font-semibold">I want to borrow</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Browse public lenders, connect with organisations, and accept invites from
            lenders who want to work with you.
          </p>
          <Button asChild variant="outline" className="mt-4">
            <Link href="/auth/register?type=borrower">Create borrower account</Link>
          </Button>
        </section>
      </div>

      <Button variant="ghost" asChild>
        <Link href="/auth/login">Already have an account? Sign in</Link>
      </Button>
    </main>
  );
}
