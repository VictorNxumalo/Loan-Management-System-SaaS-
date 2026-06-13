'use client';

import type {
  BorrowerDetailDto,
  BorrowerSearchResultDto,
  SchedulePreviewResultDto,
} from '@lms/types';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { MoneyInput } from '@/components/money-input';
import { NcaRateHint } from '@/components/loan-agreement-panel';
import { PageLoading } from '@/components/brand/loading';
import { BorrowerSearch } from '@/components/borrower-search';
import { PageHeader } from '@/components/page-header';
import { SchedulePreview } from '@/components/schedule-preview';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useApi } from '@/lib/use-api';

export default function NewLoanPage() {
  return (
    <Suspense fallback={<PageLoading label="Loading loan form…" />}>
      <NewLoanPageContent />
    </Suspense>
  );
}

function NewLoanPageContent() {
  const api = useApi();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [borrower, setBorrower] = useState<BorrowerSearchResultDto | null>(null);
  const [principalCents, setPrincipalCents] = useState<number | null>(1_000_000);
  const [annualRate, setAnnualRate] = useState('12');
  const [interestType, setInterestType] = useState<'FLAT' | 'REDUCING'>('REDUCING');
  const [termPeriods, setTermPeriods] = useState('12');
  const [frequency, setFrequency] = useState<'MONTHLY' | 'WEEKLY' | 'BI_WEEKLY'>('MONTHLY');
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [preview, setPreview] = useState<SchedulePreviewResultDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const borrowerId = searchParams.get('borrowerId');
    if (!borrowerId) return;

    void api<BorrowerDetailDto>(`/borrowers/${borrowerId}`)
      .then((result) =>
        setBorrower({
          id: result.id,
          fullName: result.fullName,
          idNumber: result.idNumber,
          label: `${result.fullName} (${result.idNumber})`,
        }),
      )
      .catch(() => undefined);
  }, [api, searchParams]);

  const buildPayload = () => ({
    principalCents: principalCents ?? 0,
    annualRate: Number(annualRate),
    interestType,
    termPeriods: Number(termPeriods),
    frequency,
    startDate,
    currencyCode: 'ZAR',
    locale: 'en-ZA',
  });

  const handlePreview = async () => {
    setError(null);
    setLoading(true);
    try {
      const result = await api<SchedulePreviewResultDto>('/loans/preview-schedule', {
        method: 'POST',
        body: JSON.stringify(buildPayload()),
      });
      setPreview(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to preview schedule');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async () => {
    if (!borrower) {
      setError('Please select a borrower');
      return;
    }
    if (!principalCents || principalCents <= 0) {
      setError('Enter a valid principal amount');
      return;
    }

    setError(null);
    setLoading(true);
    try {
      const loan = await api<{ id: string }>('/loans', {
        method: 'POST',
        body: JSON.stringify({
          ...buildPayload(),
          borrowerId: borrower.id,
        }),
      });
      router.push(`/dashboard/loans/${loan.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create loan');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        backHref="/dashboard/loans"
        backLabel="Back to loans"
        title="New loan"
        description="Preview the repayment schedule before saving the loan"
      />

      <Card>
        <CardHeader>
          <CardTitle>Loan details</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <BorrowerSearch
            value={borrower}
            onChange={setBorrower}
            error={!borrower && preview ? 'Borrower is required' : undefined}
          />
          <MoneyInput
            id="principal"
            label="Principal amount"
            valueCents={principalCents}
            onChangeCents={setPrincipalCents}
            required
          />
          <div className="space-y-2">
            <Label htmlFor="annualRate">Annual rate (%)</Label>
            <Input
              id="annualRate"
              type="number"
              step="0.01"
              value={annualRate}
              onChange={(e) => setAnnualRate(e.target.value)}
            />
            <NcaRateHint annualRate={Number(annualRate)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="interestType">Interest type</Label>
            <select
              id="interestType"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={interestType}
              onChange={(e) => setInterestType(e.target.value as 'FLAT' | 'REDUCING')}
            >
              <option value="REDUCING">Reducing balance</option>
              <option value="FLAT">Flat rate</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="termPeriods">Term (periods)</Label>
            <Input
              id="termPeriods"
              type="number"
              value={termPeriods}
              onChange={(e) => setTermPeriods(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="frequency">Frequency</Label>
            <select
              id="frequency"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={frequency}
              onChange={(e) =>
                setFrequency(e.target.value as 'MONTHLY' | 'WEEKLY' | 'BI_WEEKLY')
              }
            >
              <option value="MONTHLY">Monthly</option>
              <option value="WEEKLY">Weekly</option>
              <option value="BI_WEEKLY">Bi-weekly</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="startDate">Start date</Label>
            <Input
              id="startDate"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex flex-wrap gap-3">
        <Button type="button" onClick={() => void handlePreview()} disabled={loading || !principalCents}>
          {loading ? 'Working…' : 'Preview schedule'}
        </Button>
        {preview && (
          <Button type="button" onClick={() => void handleConfirm()} disabled={loading}>
            Confirm and save loan
          </Button>
        )}
        <Button type="button" variant="outline" asChild>
          <Link href="/dashboard/loans">Cancel</Link>
        </Button>
      </div>

      {preview && <SchedulePreview preview={preview} />}
    </div>
  );
}
