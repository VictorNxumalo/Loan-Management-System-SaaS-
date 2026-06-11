'use client';

import type { LoanDetailDto, RepaymentDto } from '@lms/types';
import { LOAN_DOCUMENT_LABELS, LoanDocumentType } from '@lms/types';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';
import { DocumentUploadPanel } from '@/components/document-upload-panel';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { canManageRecords } from '@/lib/permissions';
import { useApi } from '@/lib/use-api';

const loanDocumentTypes = Object.values(LoanDocumentType).map((value) => ({
  value,
  label: LOAN_DOCUMENT_LABELS[value],
}));

export default function LoanDetailPage() {
  const api = useApi();
  const { data: session } = useSession();
  const canManage = canManageRecords(session?.user?.role ?? undefined);
  const params = useParams<{ id: string }>();
  const [loan, setLoan] = useState<LoanDetailDto | null>(null);
  const [repayments, setRepayments] = useState<RepaymentDto[]>([]);
  const [amountCents, setAmountCents] = useState('');
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
          amountCents: Number(amountCents),
          paymentDate,
          note: note || undefined,
        }),
      });
      setAmountCents('');
      setNote('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to record repayment');
    } finally {
      setLoading(false);
    }
  };

  if (!loan) {
    return <p className="text-muted-foreground">Loading loan…</p>;
  }

  const canRecordRepayment =
    loan.status === 'ACTIVE' || loan.status === 'IN_ARREARS';

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Loan details</h1>
          <p className="text-muted-foreground">
            <Link
              href={`/dashboard/borrowers/${loan.borrowerId}`}
              className="text-primary hover:underline"
            >
              {loan.borrowerName}
            </Link>{' '}
            · {loan.principalFormatted} · {loan.status}
          </p>
        </div>
        {loan.status === 'DRAFT' && (
          <Button onClick={() => void handleActivate()} disabled={loading}>
            Activate loan
          </Button>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <SummaryCard title="Total scheduled" value={loan.totalScheduledFormatted} />
        <SummaryCard title="Total paid" value={loan.totalPaidFormatted} />
        <SummaryCard title="Outstanding" value={loan.outstandingBalanceFormatted} />
        <SummaryCard title="Annual rate" value={`${loan.annualRate}%`} />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

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
          <CardContent className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="amountCents">Amount (cents)</Label>
              <Input
                id="amountCents"
                type="number"
                value={amountCents}
                onChange={(e) => setAmountCents(e.target.value)}
              />
            </div>
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
              <Button onClick={() => void handleRepayment()} disabled={loading || !amountCents}>
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
