'use client';

import type { LoanApplicationDetailDto } from '@lms/types';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { ApplicationDocumentsPanel } from '@/components/application-documents-panel';
import { PageLoading } from '@/components/brand/loading';
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

type Step = 'details' | 'documents';

export default function NewApplicationPage() {
  return (
    <Suspense fallback={<PageLoading label="Loading form…" />}>
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

  const [step, setStep] = useState<Step>('details');
  const [application, setApplication] = useState<LoanApplicationDetailDto | null>(null);

  const [principalCents, setPrincipalCents] = useState('1000000');
  const [interestType, setInterestType] = useState<'FLAT' | 'REDUCING'>('REDUCING');
  const [termPeriods, setTermPeriods] = useState('12');
  const [frequency, setFrequency] = useState<'MONTHLY' | 'WEEKLY' | 'BI_WEEKLY'>('MONTHLY');
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [purpose, setPurpose] = useState('');
  const [accountHolder, setAccountHolder] = useState('');
  const [bankName, setBankName] = useState('');
  const [branchCode, setBranchCode] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!orgId) {
    return <EmptyOrgMessage />;
  }

  const saveDraft = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const result = await api<LoanApplicationDetailDto>('/borrower/applications', {
        method: 'POST',
        body: JSON.stringify({
          orgId,
          principalCents: Number(principalCents),
          interestType,
          termPeriods: Number(termPeriods),
          frequency,
          startDate,
          purpose: purpose.trim() || undefined,
          bankDetails: {
            accountHolder: accountHolder.trim(),
            bankName: bankName.trim(),
            branchCode: branchCode.trim(),
            accountNumber: accountNumber.trim(),
          },
        }),
      });
      setApplication(result);
      setStep('documents');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save application');
    } finally {
      setLoading(false);
    }
  };

  const submitApplication = async () => {
    if (!application) {
      return;
    }

    setError(null);
    setLoading(true);

    try {
      await api<LoanApplicationDetailDto>(
        `/borrower/applications/${application.id}/submit`,
        { method: 'POST' },
      );
      router.push(`/borrower/applications/${application.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not submit application');
    } finally {
      setLoading(false);
    }
  };

  const refreshApplication = async () => {
    if (!application) {
      return;
    }
    const updated = await api<LoanApplicationDetailDto>(
      `/borrower/applications/${application.id}`,
    );
    setApplication(updated);
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <Button variant="ghost" size="sm" asChild>
          <Link href="/borrower/lenders/mine">← Back to my lenders</Link>
        </Button>
        <h1 className="mt-4 text-2xl font-bold tracking-tight">Apply for a loan</h1>
        <p className="text-muted-foreground">
          Request a loan from{' '}
          <span className="font-medium text-foreground">{lenderName}</span>. You will need
          your ID document, bank details, and at least one recent bank statement.
        </p>
      </div>

      <div className="flex gap-2 text-sm">
        <StepBadge active={step === 'details'} done={step === 'documents'} label="1. Details" />
        <StepBadge active={step === 'documents'} done={false} label="2. Documents & submit" />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {step === 'details' ? (
        <Card>
          <CardHeader>
            <CardTitle>Loan & bank details</CardTitle>
            <CardDescription>
              The lender sets the final interest rate if they approve your request.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={(e) => void saveDraft(e)} className="space-y-6">
              <section className="space-y-4">
                <h2 className="text-sm font-semibold">Loan request</h2>
                <div className="space-y-2">
                  <Label htmlFor="principalCents">Amount (cents)</Label>
                  <Input
                    id="principalCents"
                    type="number"
                    min={1}
                    required
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

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="termPeriods">Number of payments</Label>
                    <Input
                      id="termPeriods"
                      type="number"
                      min={1}
                      required
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
                </div>

                <div className="space-y-2">
                  <Label htmlFor="startDate">Preferred start date</Label>
                  <Input
                    id="startDate"
                    type="date"
                    required
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
              </section>

              <section className="space-y-4 border-t pt-4">
                <h2 className="text-sm font-semibold">Bank account for disbursement</h2>
                <div className="space-y-2">
                  <Label htmlFor="accountHolder">Account holder name</Label>
                  <Input
                    id="accountHolder"
                    required
                    value={accountHolder}
                    onChange={(e) => setAccountHolder(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="bankName">Bank name</Label>
                  <Input
                    id="bankName"
                    required
                    value={bankName}
                    onChange={(e) => setBankName(e.target.value)}
                    placeholder="e.g. FNB, Standard Bank"
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="branchCode">Branch code</Label>
                    <Input
                      id="branchCode"
                      required
                      inputMode="numeric"
                      pattern="\d{6}"
                      maxLength={6}
                      value={branchCode}
                      onChange={(e) => setBranchCode(e.target.value.replace(/\D/g, ''))}
                      placeholder="6 digits"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="accountNumber">Account number</Label>
                    <Input
                      id="accountNumber"
                      required
                      inputMode="numeric"
                      value={accountNumber}
                      onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, ''))}
                    />
                  </div>
                </div>
              </section>

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Saving…' : 'Continue to documents'}
              </Button>
            </form>
          </CardContent>
        </Card>
      ) : application ? (
        <Card>
          <CardHeader>
            <CardTitle>Supporting documents</CardTitle>
            <CardDescription>
              Upload your SA ID and at least one bank statement before submitting. You can
              add up to three statements if you have them.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <ApplicationDocumentsPanel
              applicationId={application.id}
              requirements={application.documents.requirements}
              canManage
              onChange={() => void refreshApplication()}
            />

            <div className="flex flex-wrap gap-3">
              <Button
                variant="outline"
                onClick={() => setStep('details')}
                disabled={loading}
              >
                Back
              </Button>
              <Button
                disabled={loading || !application.documents.isComplete}
                onClick={() => void submitApplication()}
              >
                {loading ? 'Submitting…' : 'Submit application to lender'}
              </Button>
            </div>

            {!application.documents.isComplete && (
              <p className="text-sm text-amber-700">
                Upload all required documents before you can submit.
              </p>
            )}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function StepBadge({
  active,
  done,
  label,
}: {
  active: boolean;
  done: boolean;
  label: string;
}) {
  return (
    <span
      className={`rounded-full px-3 py-1 ${
        active
          ? 'bg-primary text-primary-foreground'
          : done
            ? 'bg-green-100 text-green-900'
            : 'bg-muted text-muted-foreground'
      }`}
    >
      {label}
    </span>
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
