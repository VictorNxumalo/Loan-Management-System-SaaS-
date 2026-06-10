'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useApi } from '@/lib/use-api';

export default function NewApplicationPage() {
  return (
    <Suspense fallback={<p className="text-muted-foreground">Loading form…</p>}>
      <NewApplicationPageContent />
    </Suspense>
  );
}

function NewApplicationPageContent() {
  const api = useApi();
  const router = useRouter();
  const searchParams = useSearchParams();
  const orgId = searchParams.get('orgId');
  const lenderName = searchParams.get('lenderName') ?? 'this lender';

  const [principalCents, setPrincipalCents] = useState('1000000');
  const [interestType, setInterestType] = useState<'FLAT' | 'REDUCING'>('REDUCING');
  const [termPeriods, setTermPeriods] = useState('12');
  const [frequency, setFrequency] = useState<'MONTHLY' | 'WEEKLY' | 'BI_WEEKLY'>('MONTHLY');
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [purpose, setPurpose] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!orgId) {
    return (
      <EmptyOrgMessage />
    );
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const result = await api<{ id: string }>('/borrower/applications', {
        method: 'POST',
        body: JSON.stringify({
          orgId,
          principalCents: Number(principalCents),
          interestType,
          termPeriods: Number(termPeriods),
          frequency,
          startDate,
          purpose: purpose.trim() || undefined,
        }),
      });
      router.push(`/borrower/applications/${result.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not submit application');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div>
        <Button variant="ghost" size="sm" asChild>
          <Link href="/borrower/lenders/mine">← Back to my lenders</Link>
        </Button>
        <h1 className="mt-4 text-2xl font-bold tracking-tight">Apply for a loan</h1>
        <p className="text-muted-foreground">
          Submit a request to <span className="font-medium text-foreground">{lenderName}</span>.
          They will review and respond from their dashboard.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Application details</CardTitle>
          <CardDescription>
            The lender sets the final interest rate if they approve your request.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error && <p className="mb-4 text-sm text-destructive">{error}</p>}
          <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="principalCents">Amount (cents)</Label>
              <Input
                id="principalCents"
                type="number"
                min={1}
                value={principalCents}
                onChange={(e) => setPrincipalCents(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Example: 1000000 = R 10,000.00
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="interestType">Preferred interest method</Label>
              <select
                id="interestType"
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                value={interestType}
                onChange={(e) => setInterestType(e.target.value as 'FLAT' | 'REDUCING')}
              >
                <option value="REDUCING">Reducing balance</option>
                <option value="FLAT">Flat rate</option>
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="termPeriods">Number of payments</Label>
              <Input
                id="termPeriods"
                type="number"
                min={1}
                value={termPeriods}
                onChange={(e) => setTermPeriods(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="frequency">Payment frequency</Label>
              <select
                id="frequency"
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
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
              <Label htmlFor="startDate">Preferred start date</Label>
              <Input
                id="startDate"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="purpose">Purpose (optional)</Label>
              <Input
                id="purpose"
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
                placeholder="e.g. Home repairs, school fees"
              />
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Submitting…' : 'Submit application'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

function EmptyOrgMessage() {
  return (
    <div className="space-y-4">
      <p className="text-muted-foreground">
        Choose a lender from My lenders before starting an application.
      </p>
      <Button asChild>
        <Link href="/borrower/lenders/mine">Go to my lenders</Link>
      </Button>
    </div>
  );
}
