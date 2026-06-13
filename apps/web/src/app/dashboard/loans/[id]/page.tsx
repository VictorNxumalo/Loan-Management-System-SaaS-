'use client';

import type { LoanDetailDto, RepaymentDto } from '@lms/types';
import { LOAN_DOCUMENT_LABELS, LoanDocumentType } from '@lms/types';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';
import { CardSkeleton } from '@/components/brand/skeleton';
import {
  GenerateLoanAgreementButton,
  LoanAgreementNcaNotice,
} from '@/components/loan-agreement-panel';
import { MoneyInput } from '@/components/money-input';
import { DocumentUploadPanel } from '@/components/document-upload-panel';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { canManageRecords } from '@/lib/permissions';
import { useApi } from '@/lib/use-api';

const loanDocumentTypes = [
  {
    value: LoanDocumentType.DISBURSEMENT_PROOF,
    label: LOAN_DOCUMENT_LABELS[LoanDocumentType.DISBURSEMENT_PROOF],
  },
];

export default function LoanDetailPage() {
  const api = useApi();
  const { data: session } = useSession();
  const canManage = canManageRecords(session?.user?.role ?? undefined);
  const params = useParams<{ id: string }>();
  const [loan, setLoan] = useState<LoanDetailDto | null>(null);
  const [repayments, setRepayments] = useState<RepaymentDto[]>([]);
  const [amountCents, setAmountCents] = useState<number | null>(null);
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    const [loanData, repaymentData] = await Promise.all([
      api<LoanDetailDto>(`/loans/${params.id}`),
      api<RepaymentDto[]>(`/loans/${params.id}/repayments`),
    ]);
    setLoan(loanData);
    setRepayments(repaymentData);
  };

  useEffect(() => {
    void load().catch((err: Error) => setError(err.message));
  }, [api, params.id]);

  const handleDisburse = async () => {
    setLoading(true);
    setError(null);
    try {
      const updated = await api<LoanDetailDto>(`/loans/${params.id}/disburse`, {
        method: 'POST',
      });
      setLoan(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to disburse loan');
    } finally {
      setLoading(false);
    }
  };

  const handleActivate = async () => {
    setLoading(true);
    setError(null);
    try {
      const updated = await api<LoanDetailDto>(`/loans/${params.id}/activate`, {
        method: 'POST',
      });
      setLoan(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to activate loan');
    } finally {
      setLoading(false);
    }
  };

  const handleRepayment = async () => {
    setLoading(true);
    setError(null);
    try {
      await api(`/loans/${params.id}/repayments`, {
        method: 'POST',
        body: JSON.stringify({
          amountCents: amountCents ?? 0,
          paymentDate,
          note: note || undefined,
        }),
      });
      setAmountCents(null);
      setNote('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to record repayment');
    } finally {
      setLoading(false);
    }
  };

  if (!loan) {
    return (
      <div className="space-y-6">
        <CardSkeleton rows={4} />
        <CardSkeleton rows={5} />
      </div>
    );
  }

  const canRecordRepayment =
    loan.status === 'ACTIVE' || loan.status === 'IN_ARREARS';

  return (
    <div className="space-y-6">
      <PageHeader
        title="Loan details"
        description={
          <>
            <Link
              href={`/dashboard/borrowers/${loan.borrowerId}`}
              className="text-primary hover:underline"
            >
              {loan.borrowerName}
            </Link>{' '}
            · {loan.principalFormatted} · {loan.status}
            {loan.disbursementStatus === 'COMPLETED' && loan.disbursedAt
              ? ` · Disbursed ${loan.disbursedAt.slice(0, 10)}`
              : loan.disbursementStatus === 'PENDING'
                ? ' · Disbursement pending (Stitch)'
                : loan.disbursementStatus === 'FAILED'
                  ? ' · Disbursement failed'
                  : ''}
          </>
        }
        actions={
          <>
            {loan.status === 'DRAFT' && canManage ? (
              <Button onClick={() => void handleActivate()} disabled={loading}>
                Activate loan
              </Button>
            ) : null}
            {(loan.status === 'ACTIVE' || loan.status === 'IN_ARREARS') &&
            canManage &&
            loan.disbursementStatus !== 'COMPLETED' &&
            loan.disbursementStatus !== 'PENDING' ? (
              <Button
                variant="secondary"
                onClick={() => void handleDisburse()}
                disabled={loading}
              >
                Disburse funds
              </Button>
            ) : null}
          </>
        }
      />

      <div className="grid gap-4 md:grid-cols-4">
        <SummaryCard title="Total scheduled" value={loan.totalScheduledFormatted} />
        <SummaryCard title="Total paid" value={loan.totalPaidFormatted} />
        <SummaryCard title="Outstanding" value={loan.outstandingBalanceFormatted} />
        <SummaryCard title="Annual rate" value={`${loan.annualRate}%`} />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {loan.stitchDisbursement ? (
        <div
          className={`rounded-lg border p-4 text-sm ${
            loan.stitchDisbursement.status === 'COMPLETED'
              ? 'border-green-200 bg-green-50 text-green-900'
              : loan.stitchDisbursement.status === 'ERROR' ||
                  loan.stitchDisbursement.status === 'CANCELLED' ||
                  loan.stitchDisbursement.status === 'REVERSED'
                ? 'border-red-200 bg-red-50 text-red-900'
                : 'border-amber-200 bg-amber-50 text-amber-900'
          }`}
        >
          <p className="font-medium">Stitch bank disbursement — {loan.stitchDisbursement.status}</p>
          <p className="mt-1 text-muted-foreground">
            {loan.stitchDisbursement.amountFormatted} to{' '}
            {loan.stitchDisbursement.beneficiaryName} (
            {loan.stitchDisbursement.beneficiaryBankId}{' '}
            {loan.stitchDisbursement.beneficiaryAccountNumberMasked})
          </p>
          {loan.stitchDisbursement.statusReason ? (
            <p className="mt-1">{loan.stitchDisbursement.statusReason}</p>
          ) : null}
          {loan.disbursementStatus === 'PENDING' ? (
            <p className="mt-2 text-xs">
              Waiting for Stitch to confirm payment to the borrower&apos;s bank. This can take a
              few minutes.
            </p>
          ) : null}
        </div>
      ) : null}

      {canManage && loan.status === 'DRAFT' ? (
        <div className="rounded-lg border bg-background p-4 space-y-3">
          <h2 className="font-semibold">Loan agreement</h2>
          <LoanAgreementNcaNotice />
          <GenerateLoanAgreementButton agreementPath={`/loans/${loan.id}/loan-agreement`} />
          <p className="text-xs text-muted-foreground">
            Use the generated LMS template instead of uploading a separate signed agreement.
            Optional disbursement proof can still be attached below.
          </p>
        </div>
      ) : null}

      <DocumentUploadPanel
        entityType="LOAN"
        entityId={loan.id}
        documentTypes={loanDocumentTypes}
        canManage={canManage}
        title="Loan documents"
      />

      {canRecordRepayment && (
        <Card>
          <CardHeader>
            <CardTitle>Record repayment</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <MoneyInput
              id="repayment-amount"
              label="Repayment amount"
              valueCents={amountCents}
              onChangeCents={setAmountCents}
              required
            />
            <div className="space-y-2">
              <Label htmlFor="paymentDate">Payment date</Label>
              <Input
                id="paymentDate"
                type="date"
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="note">Note</Label>
              <Input id="note" value={note} onChange={(e) => setNote(e.target.value)} />
            </div>
            <div className="md:col-span-3">
              <Button
                onClick={() => void handleRepayment()}
                disabled={loading || !amountCents || amountCents <= 0}
              >
                Record repayment
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Repayment history</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="bg-muted/50 text-left">
                <tr>
                  <th className="px-3 py-2">Date</th>
                  <th className="px-3 py-2">Amount</th>
                  <th className="px-3 py-2">Recorded by</th>
                  <th className="px-3 py-2">Note</th>
                </tr>
              </thead>
              <tbody>
                {repayments.map((repayment) => (
                  <tr key={repayment.id} className="border-t">
                    <td className="px-3 py-2">{repayment.paymentDate}</td>
                    <td className="px-3 py-2">{repayment.amountFormatted}</td>
                    <td className="px-3 py-2">{repayment.recordedByName}</td>
                    <td className="px-3 py-2">{repayment.note ?? '—'}</td>
                  </tr>
                ))}
                {repayments.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-3 py-8 text-center text-muted-foreground">
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
          <CardTitle>Amortisation schedule</CardTitle>
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
