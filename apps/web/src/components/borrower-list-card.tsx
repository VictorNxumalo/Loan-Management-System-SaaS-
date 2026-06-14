'use client';

import type { BorrowerListItemDto } from '@lms/types';
import Link from 'next/link';
import { ChevronRight, UserRound } from 'lucide-react';

export function BorrowerListCard({ borrower }: { borrower: BorrowerListItemDto }) {
  return (
    <article className="rounded-xl border bg-card p-4 shadow-sm sm:p-5">
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-green/10 text-brand-navy">
          <UserRound className="h-5 w-5" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="font-semibold">{borrower.fullName}</h3>
              <p className="text-sm text-muted-foreground">ID {borrower.idNumber}</p>
            </div>
            <Link
              href={`/dashboard/borrowers/${borrower.id}`}
              className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
            >
              View profile
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>

          <dl className="mt-4 grid grid-cols-1 gap-3 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-xs uppercase tracking-wide text-muted-foreground">Phone</dt>
              <dd className="mt-1 font-medium break-all">{borrower.phone}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-muted-foreground">Email</dt>
              <dd className="mt-1 font-medium break-all">{borrower.email ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-muted-foreground">Active loans</dt>
              <dd className="mt-1 font-medium">{borrower.summary.totalLoans}</dd>
            </div>
          </dl>

          <div className="mt-4 grid grid-cols-1 gap-3 border-t pt-4 sm:grid-cols-2">
            <div className="rounded-lg bg-muted/50 px-3 py-2">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Outstanding</p>
              <p className="mt-1 font-semibold text-sky-700">
                {borrower.summary.totalOutstandingFormatted}
              </p>
            </div>
            <div className="rounded-lg bg-muted/50 px-3 py-2">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">In arrears</p>
              <p
                className={`mt-1 font-semibold ${
                  borrower.summary.loansInArrears > 0 ? 'text-amber-700' : 'text-emerald-700'
                }`}
              >
                {borrower.summary.loansInArrears > 0
                  ? `${borrower.summary.loansInArrears} loan${borrower.summary.loansInArrears === 1 ? '' : 's'}`
                  : 'None'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}

export function BorrowerPortfolioSummaryCards({
  summary,
  totalPeople,
}: {
  summary: BorrowerListItemDto['summary'];
  totalPeople: number;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <div className="rounded-xl border bg-card p-4">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">People you lend to</p>
        <p className="mt-2 text-2xl font-semibold">{totalPeople}</p>
      </div>
      <div className="rounded-xl border bg-card p-4">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">Active loans</p>
        <p className="mt-2 text-2xl font-semibold">{summary.totalLoans}</p>
      </div>
      <div className="rounded-xl border bg-card p-4">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">Outstanding</p>
        <p className="mt-2 text-2xl font-semibold text-sky-700">
          {summary.totalOutstandingFormatted}
        </p>
      </div>
      <div className="rounded-xl border bg-card p-4">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">In arrears</p>
        <p
          className={`mt-2 text-2xl font-semibold ${
            summary.loansInArrears > 0 ? 'text-amber-700' : 'text-emerald-700'
          }`}
        >
          {summary.loansInArrears}
        </p>
      </div>
    </div>
  );
}
