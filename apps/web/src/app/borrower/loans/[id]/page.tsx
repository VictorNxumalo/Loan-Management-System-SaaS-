'use client';

import type { BorrowerLoanDetailDto } from '@lms/types';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { PageLoading } from '@/components/brand/loading';
import { LoanStatusBadge } from '@/components/loan-status-badge';
import { PayFromWalletDialog } from '@/components/pay-from-wallet-dialog';
import { PayLenderDialog } from '@/components/pay-lender-dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuthenticatedQuery } from '@/lib/use-authenticated-query';

export default function BorrowerLoanDetailPage() {
  const params = useParams<{ id: string }>();
  const [walletPayOpen, setWalletPayOpen] = useState(false);
  const [externalPayOpen, setExternalPayOpen] = useState(false);
  const { data: loan, error, loading, refetch } = useAuthenticatedQuery<BorrowerLoanDetailDto>(
    params.id ? `/borrower/loans/${params.id}` : null,
  );

  if (loading && !loan) {
    return (
      <>
        <PageLoading label="Loading loan…" />
        <PayFromWalletDialog
          loanId={params.id}
          outstandingFormatted="—"
          open={walletPayOpen}
          onClose={() => setWalletPayOpen(false)}
          onSubmitted={() => void refetch({ silent: true })}
        />
        <PayLenderDialog
          loanId={params.id}
          outstandingFormatted="—"
          open={externalPayOpen}
          onClose={() => setExternalPayOpen(false)}
          onSubmitted={() => void refetch({ silent: true })}
        />
      </>
    );
  }

  if (error || !loan) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-destructive">{error ?? 'Loan not found'}</p>
        <Link href="/borrower/loans" className="text-sm text-primary hover:underline">
          Back to my loans
        </Link>
      </div>
    );
  }

  const inProgressPayments = loan.pendingPayments.filter(
    (payment) => payment.status === 'AWAITING_PROOF' || payment.status === 'PENDING',
  );
  const rejectedPayments = loan.pendingPayments.filter((payment) => payment.status === 'REJECTED');

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/borrower/loans"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Back to my loans
        </Link>
        <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Loan details</h1>
            <p className="text-muted-foreground">
              {loan.organisationName} · {loan.principalFormatted}
            </p>
          </div>
          <LoanStatusBadge status={loan.status} />
        </div>
      </div>

      {loan.status === 'IN_ARREARS' && loan.daysOverdue != null && loan.daysOverdue > 0 && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
          This loan is {loan.daysOverdue} day{loan.daysOverdue === 1 ? '' : 's'} overdue.
          Please contact {loan.organisationName} to arrange payment.
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-4">
        <SummaryCard title="Total scheduled" value={loan.totalScheduledFormatted} />
        <SummaryCard title="Total paid" value={loan.totalPaidFormatted} />
        <SummaryCard title="Outstanding" value={loan.outstandingBalanceFormatted} />
        <SummaryCard title="Annual rate" value={`${loan.annualRate}%`} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Loan terms</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm md:grid-cols-2">
          <DetailRow label="Start date" value={loan.startDate} />
          <DetailRow label="Term" value={`${loan.termPeriods} periods`} />
          <DetailRow
            label="Frequency"
            value={loan.frequency.toLowerCase().replace('_', '-')}
          />
          <DetailRow label="Interest type" value={loan.interestType.toLowerCase()} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-4">
          <CardTitle>Repayment history</CardTitle>
          <div className="flex flex-wrap gap-2">
            {loan.canPayFromWallet && (
              <Button size="sm" onClick={() => setWalletPayOpen(true)}>
                Pay from wallet
              </Button>
            )}
            {loan.canReportExternalPayment && (
              <Button size="sm" variant="outline" onClick={() => setExternalPayOpen(true)}>
                Report bank payment
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {inProgressPayments.length > 0 && (
            <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm">
              <p className="font-medium text-amber-900">Awaiting lender review</p>
              <ul className="mt-2 space-y-1 text-amber-800">
                {inProgressPayments.map((payment) => (
                  <li key={payment.id}>
                    {payment.amountFormatted} on {payment.paymentDate} — {payment.statusLabel}
                    {payment.referenceNote ? ` (${payment.referenceNote})` : ''}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {rejectedPayments.length > 0 && (
            <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm">
              <p className="font-medium text-red-900">Rejected payments</p>
              <ul className="mt-2 space-y-2 text-red-800">
                {rejectedPayments.map((payment) => (
                  <li key={payment.id}>
                    <span>
                      {payment.amountFormatted} on {payment.paymentDate}
                    </span>
                    {payment.reviewNote && (
                      <span className="mt-1 block text-red-900">
                        Lender note: {payment.reviewNote}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
              {loan.canReportExternalPayment && (
                <p className="mt-2 text-red-900">
                  You can submit a new payment with updated proof using Report bank payment.
                </p>
              )}
            </div>
          )}
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full min-w-[480px] text-sm">
              <thead className="bg-muted/50 text-left">
                <tr>
                  <th className="px-3 py-2">Date</th>
                  <th className="px-3 py-2">Amount</th>
                  <th className="px-3 py-2">Note</th>
                </tr>
              </thead>
              <tbody>
                {loan.repayments.map((repayment) => (
                  <tr key={repayment.id} className="border-t">
                    <td className="px-3 py-2">{repayment.paymentDate}</td>
                    <td className="px-3 py-2">{repayment.amountFormatted}</td>
                    <td className="px-3 py-2">{repayment.note ?? '—'}</td>
                  </tr>
                ))}
                {loan.repayments.length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-3 py-8 text-center text-muted-foreground">
                      No repayments recorded yet
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Repayment schedule</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="bg-muted/50 text-left">
                <tr>
                  <th className="px-3 py-2">#</th>
                  <th className="px-3 py-2">Due date</th>
                  <th className="px-3 py-2">Principal</th>
                  <th className="px-3 py-2">Interest</th>
                  <th className="px-3 py-2">Total</th>
                  <th className="px-3 py-2">Balance after</th>
                </tr>
              </thead>
              <tbody>
                {loan.schedule.map((period) => (
                  <tr key={period.periodNumber} className="border-t">
                    <td className="px-3 py-2">{period.periodNumber}</td>
                    <td className="px-3 py-2">{period.dueDate}</td>
                    <td className="px-3 py-2">{period.principalDueFormatted}</td>
                    <td className="px-3 py-2">{period.interestDueFormatted}</td>
                    <td className="px-3 py-2">{period.totalDueFormatted}</td>
                    <td className="px-3 py-2">{period.balanceAfterFormatted}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <PayFromWalletDialog
        loanId={loan.id}
        outstandingFormatted={loan.outstandingBalanceFormatted}
        open={walletPayOpen}
        onClose={() => setWalletPayOpen(false)}
        onSubmitted={() => void refetch({ silent: true })}
      />
      <PayLenderDialog
        loanId={loan.id}
        outstandingFormatted={loan.outstandingBalanceFormatted}
        open={externalPayOpen}
        onClose={() => setExternalPayOpen(false)}
        onSubmitted={() => void refetch({ silent: true })}
      />
    </div>
  );
}

function SummaryCard({ title, value }: { title: string; value: string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-semibold">{value}</p>
      </CardContent>
    </Card>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-muted-foreground">{label}</p>
      <p className="font-medium capitalize">{value}</p>
    </div>
  );
}
