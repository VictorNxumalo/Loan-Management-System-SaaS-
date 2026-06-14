'use client';

import type { LoanListItemDto } from '@lms/types';
import { CalendarDays, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

function statusStyles(status: string, daysOverdue: number) {
  if (status === 'COMPLETED') {
    return {
      border: 'border-l-slate-400',
      badge: 'bg-slate-100 text-slate-700',
      label: 'Completed',
    };
  }
  if (status === 'IN_ARREARS' || daysOverdue > 0) {
    return {
      border: 'border-l-amber-500',
      badge: 'bg-amber-100 text-amber-900',
      label: 'Late',
    };
  }
  if (status === 'ACTIVE') {
    return {
      border: 'border-l-emerald-500',
      badge: 'bg-emerald-100 text-emerald-800',
      label: 'Active',
    };
  }
  return {
    border: 'border-l-slate-300',
    badge: 'bg-slate-100 text-slate-700',
    label: status.replaceAll('_', ' '),
  };
}

export function LoanPortfolioCard({ loan }: { loan: LoanListItemDto }) {
  const styles = statusStyles(loan.status, loan.daysOverdue);
  const progress =
    loan.termPeriods > 0 ? Math.min(100, (loan.paymentsMade / loan.termPeriods) * 100) : 0;

  return (
    <article
      className={cn(
        'rounded-xl border border-l-4 bg-card p-4 shadow-sm sm:p-5',
        styles.border,
      )}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-navy/10 text-sm font-semibold text-brand-navy">
            {initials(loan.borrowerName)}
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="truncate font-semibold">{loan.borrowerName}</h3>
              <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', styles.badge)}>
                {styles.label}
              </span>
            </div>
            <p className="text-sm text-muted-foreground">
              {loan.loanReference} · {loan.interestType.replace('_', ' ')} · {loan.annualRate}%
              p.a.
            </p>
          </div>
        </div>
      </div>

      {loan.nextPaymentDueDate && loan.status !== 'COMPLETED' && loan.status !== 'DRAFT' ? (
        <div
          className={cn(
            'mt-4 rounded-lg px-3 py-2 text-sm',
            loan.daysOverdue > 0
              ? 'bg-amber-50 text-amber-900'
              : 'bg-muted/60 text-muted-foreground',
          )}
        >
          {loan.daysOverdue > 0 ? (
            <>
              Payment of {loan.nextPaymentAmountFormatted} was due {loan.daysOverdue} day
              {loan.daysOverdue === 1 ? '' : 's'} ago — follow up with borrower
            </>
          ) : (
            <>
              Next payment of {loan.nextPaymentAmountFormatted} due {loan.nextPaymentDueDate}
              {loan.nextPaymentDaysUntil != null
                ? ` (${loan.nextPaymentDaysUntil} day${loan.nextPaymentDaysUntil === 1 ? '' : 's'})`
                : ''}
            </>
          )}
        </div>
      ) : null}

      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
        <div>
          <dt className="text-xs uppercase tracking-wide text-muted-foreground">Principal</dt>
          <dd className="mt-1 font-medium">{loan.principalFormatted}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-muted-foreground">Outstanding</dt>
          <dd className="mt-1 font-medium text-sky-700">{loan.outstandingBalanceFormatted}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-muted-foreground">Interest earned</dt>
          <dd className="mt-1 font-medium text-emerald-700">{loan.interestEarnedFormatted}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-muted-foreground">Start date</dt>
          <dd className="mt-1 font-medium">{loan.startDate}</dd>
        </div>
      </dl>

      <div className="mt-4 space-y-2">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            Repayment progress — {loan.paymentsMade} of {loan.termPeriods} payments made
          </span>
          <span>{Math.round(progress)}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-emerald-500 transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
            Started {loan.startDate}
          </span>
          <span>{loan.termPeriods} period term</span>
        </div>
        <Link
          href={`/dashboard/loans/${loan.id}`}
          className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
        >
          View details
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </div>
    </article>
  );
}

export function LoanPortfolioSummaryCards({
  summary,
}: {
  summary: {
    totalLentFormatted: string;
    interestEarnedFormatted: string;
    outstandingFormatted: string;
    activeLoanCount: number;
    latePaymentCount: number;
  };
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <SummaryTile
        label="Total lent out"
        value={summary.totalLentFormatted}
        hint={`${summary.activeLoanCount} active loan${summary.activeLoanCount === 1 ? '' : 's'}`}
      />
      <SummaryTile
        label="Interest earned"
        value={summary.interestEarnedFormatted}
        hint="From recorded repayments"
        valueClassName="text-emerald-700"
      />
      <SummaryTile
        label="Outstanding"
        value={summary.outstandingFormatted}
        hint="Across active loans"
        valueClassName="text-sky-700"
      />
      <SummaryTile
        label="Late payments"
        value={String(summary.latePaymentCount)}
        hint={summary.latePaymentCount > 0 ? 'Action needed' : 'All current'}
        valueClassName={summary.latePaymentCount > 0 ? 'text-amber-700' : undefined}
      />
    </div>
  );
}

function SummaryTile({
  label,
  value,
  hint,
  valueClassName,
}: {
  label: string;
  value: string;
  hint: string;
  valueClassName?: string;
}) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={cn('mt-2 text-2xl font-semibold tracking-tight', valueClassName)}>{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}
