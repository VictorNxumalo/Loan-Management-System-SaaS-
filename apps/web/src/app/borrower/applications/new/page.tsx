'use client';

import type { BorrowerLendingStatusDto, UserProfileDto } from '@lms/types';
import {
  BORROWER_CONSENT_POLICY_VERSION,
  BORROWER_CONSENT_TEXT,
} from '@lms/types';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { PageLoading } from '@/components/brand/loading';
import { BorrowerLendingStatusBanner } from '@/components/borrower-lending-status-banner';
import { MoneyInput } from '@/components/money-input';
import {
  ProfileBankAccountMissing,
  ProfileBankAccountSummary,
} from '@/components/profile-bank-account-summary';
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
import { useAuthenticatedQuery } from '@/lib/use-authenticated-query';

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

  const profileQuery = useAuthenticatedQuery<UserProfileDto>('/auth/profile');
  const lendingStatusQuery = useAuthenticatedQuery<BorrowerLendingStatusDto>(
    '/borrower/lending-status',
  );

  const [principalCents, setPrincipalCents] = useState<number | null>(1_000_000);
  const [interestType, setInterestType] = useState<'FLAT' | 'REDUCING'>('REDUCING');
  const [termPeriods, setTermPeriods] = useState('12');
  const [frequency, setFrequency] = useState<'MONTHLY' | 'WEEKLY' | 'BI_WEEKLY'>('MONTHLY');
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [purpose, setPurpose] = useState('');
  const [consentCreditChecks, setConsentCreditChecks] = useState(false);
  const [consentDataSharing, setConsentDataSharing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const profile = profileQuery.data;
  const lendingStatus = lendingStatusQuery.data;
  const hasProfileBank = Boolean(profile?.bankAccount);
  const hasProfileId = Boolean(profile?.idDocument);
  const canStartNewApplication = lendingStatus?.canStartNewApplication !== false;
  const canSubmit =
    hasProfileBank &&
    hasProfileId &&
    canStartNewApplication &&
    consentCreditChecks &&
    consentDataSharing;
  const profileLoading = profileQuery.loading || lendingStatusQuery.loading;

  if (!orgId) {
    return <EmptyOrgMessage />;
  }

  const submitApplication = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!principalCents || principalCents <= 0) {
      setError('Enter a valid loan amount');
      return;
    }

    if (!canStartNewApplication) {
      setError(
        lendingStatus?.message ??
          'You cannot start a new application while you have an open loan or application.',
      );
      return;
    }

    if (!hasProfileBank) {
      setError('Link a bank account in your profile before applying');
      return;
    }

    if (!hasProfileId) {
      setError('Upload your SA ID in profile settings before applying');
      return;
    }

    if (!consentCreditChecks || !consentDataSharing) {
      setError('You must accept the consent statements before submitting');
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const draft = await api<{ id: string }>('/borrower/applications', {
        method: 'POST',
        body: JSON.stringify({
          orgId,
          principalCents,
          interestType,
          termPeriods: Number(termPeriods),
          frequency,
          startDate,
          purpose: purpose.trim() || undefined,
          consent: {
            creditChecks: consentCreditChecks,
            dataSharing: consentDataSharing,
            policyVersion: BORROWER_CONSENT_POLICY_VERSION,
          },
        }),
      });
      await api(`/borrower/applications/${draft.id}/submit`, { method: 'POST' });
      router.push(`/borrower/applications/${draft.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not submit application');
    } finally {
      setLoading(false);
    }
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
          <span className="font-medium text-foreground">{lenderName}</span>. Your bank
          account and SA ID from your profile are included automatically — no extra uploads
          needed here.
        </p>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
      {profileQuery.error && (
        <p className="text-sm text-destructive">{profileQuery.error}</p>
      )}

      <BorrowerLendingStatusBanner />

      {!canStartNewApplication && lendingStatus?.message && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          <p>{lendingStatus.message}</p>
          <p className="mt-2">
            <Link href="/borrower/applications" className="font-medium underline">
              View my applications
            </Link>
            {' · '}
            <Link href="/borrower/loans" className="font-medium underline">
              View my loans
            </Link>
          </p>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Loan application</CardTitle>
          <CardDescription>
            The lender sets the final interest rate if they approve your request.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {profileLoading ? (
            <PageLoading label="Loading your profile…" />
          ) : (
            <form onSubmit={(e) => void submitApplication(e)} className="space-y-6">
              <section className="space-y-4">
                <h2 className="text-sm font-semibold">Loan request</h2>
                <MoneyInput
                  id="principal"
                  label="Loan amount"
                  valueCents={principalCents}
                  onChangeCents={setPrincipalCents}
                  required
                />

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
                <h2 className="text-sm font-semibold">From your profile</h2>
                <p className="text-sm text-muted-foreground">
                  These details are sent to the lender with your application.
                </p>

                <div className="space-y-2">
                  <p className="text-sm font-medium">Bank account for disbursement</p>
                  {profile?.bankAccount ? (
                    <ProfileBankAccountSummary bankAccount={profile.bankAccount} />
                  ) : (
                    <ProfileBankAccountMissing />
                  )}
                </div>

                <div className="space-y-2">
                  <p className="text-sm font-medium">SA ID document</p>
                  {profile?.idDocument ? (
                    <p className="rounded-md border bg-muted/20 px-3 py-2 text-sm">
                      On file: {profile.idDocument.originalFilename}
                    </p>
                  ) : (
                    <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                      No ID on file.{' '}
                      <Link
                        href="/borrower/profile"
                        className="font-medium underline-offset-4 hover:underline"
                      >
                        Upload in profile settings
                      </Link>{' '}
                      before applying.
                    </div>
                  )}
                </div>
              </section>

              <section className="space-y-3 border-t pt-4">
                <h2 className="text-sm font-semibold">Consent</h2>
                <p className="text-xs text-muted-foreground">
                  Policy version {BORROWER_CONSENT_POLICY_VERSION}
                </p>
                <label className="flex items-start gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={consentCreditChecks}
                    onChange={(event) => setConsentCreditChecks(event.target.checked)}
                    className="mt-0.5"
                  />
                  <span>{BORROWER_CONSENT_TEXT.creditChecks}</span>
                </label>
                <label className="flex items-start gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={consentDataSharing}
                    onChange={(event) => setConsentDataSharing(event.target.checked)}
                    className="mt-0.5"
                  />
                  <span>{BORROWER_CONSENT_TEXT.dataSharing}</span>
                </label>
              </section>

              <Button type="submit" className="w-full" disabled={loading || !canSubmit}>
                {loading ? 'Submitting…' : 'Submit application to lender'}
              </Button>
              {!canStartNewApplication && (
                <p className="text-sm text-muted-foreground">
                  You cannot start a new application until your current loan or open
                  application is resolved.
                </p>
              )}
            </form>
          )}
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
