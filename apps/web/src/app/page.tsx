import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-8">
      <div className="text-center">
        <h1 className="text-4xl font-bold tracking-tight">LMS</h1>
        <p className="mt-2 text-lg text-muted-foreground">
          Loan Management System for lenders
        </p>
      </div>
      <div className="flex gap-4">
        <Button asChild>
          <Link href="/auth/register">Get Started</Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href="/auth/login">Sign in</Link>
        </Button>
      </div>
    </main>
  );
}
