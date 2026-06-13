'use client';

import { InterestType, type AuthMeResponse } from '@lms/types';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { AuthShell } from '@/components/brand/auth-shell';
import { PageLoading } from '@/components/brand/loading';
import { LmsLoaderMark } from '@/components/brand/logo';
import { BankDetailsFields, KycProfileFields } from '@/components/kyc-profile-fields';
import { KycIdUpload } from '@/components/kyc-id-upload';
import { OnboardingStepGuide } from '@/components/onboarding-guide';
import { OrganisationLogoUpload } from '@/components/organisation-logo-upload';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { apiFetch } from '@/lib/api';
import { isLenderAccount } from '@/lib/routes';

export default function OnboardingPage() {
  const { data: session, status, update } = useSession();
  const router = useRouter();
  const [pageReady, setPageReady] = useState(false);
  const [step, setStep] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [idUploaded, setIdUploaded] = useState(false);

  const [organisationName, setOrganisationName] = useState('');
  const [defaultCurrency, setDefaultCurrency] = useState('ZAR');
  const [defaultInterestType, setDefaultInterestType] = useState<string>(
    InterestType.REDUCING,
  );
  const [logoStoragePath, setLogoStoragePath] = useState<string | null>(null);

  const [idNumber, setIdNumber] = useState('');
  const [address, setAddress] = useState('');
  const [accountHolder, setAccountHolder] = useState('');
  const [bankName, setBankName] = useState('');
  const [branchCode, setBranchCode] = useState('');
  const [accountNumber, setAccountNumber] = useState('');

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace('/auth/login');
      return;
    }

    if (status !== 'authenticated' || !session?.accessToken) return;

    let cancelled = false;

    void (async () => {
      try {
        const me = await apiFetch<AuthMeResponse>('/auth/me', {
          accessToken: session.accessToken,
        });

        if (cancelled) return;

        if (me.user.accountType === 'BORROWER') {
          router.replace(
            me.user.profileComplete ? '/borrower' : '/borrower/onboarding',
          );
          return;
        }

        if (me.user.profileComplete) {
          router.replace('/dashboard');
          return;
        }

        if (isLenderAccount(me)) {
          setOrganisationName(me.organisation?.name ?? '');
          setPageReady(true);
        }
      } catch {
        if (!cancelled) {
          router.replace('/auth/login');
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [status, session, router]);

  const submit = async () => {
    if (!session?.accessToken) return;
    setSubmitting(true);
    setError(null);

    try {
      await apiFetch('/auth/onboarding', {
        method: 'PATCH',
        accessToken: session.accessToken,
        body: JSON.stringify({
          organisationName,
          defaultCurrency,
          defaultInterestType,
          idNumber,
          address,
          bankDetails: { accountHolder, bankName, branchCode, accountNumber },
          ...(logoStoragePath ? { logoStoragePath } : {}),
        }),
      });

      await update();
      router.push('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not complete onboarding');
    } finally {
      setSubmitting(false);
    }
  };

  if (status === 'loading' || !pageReady) {
    return <PageLoading label="Preparing your workspace…" className="min-h-screen" />;
  }

  return (
    <AuthShell
      title="Complete your lender profile"
      description="One-time verification is required before you can use the platform. This includes your identity, ID document, and bank account linked to your wallet."
    >
      {error && (
        <p className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </p>
      )}

      <OnboardingStepGuide variant="lender" step={step} />

      <div className="mb-6 flex gap-2 text-xs text-muted-foreground">
        <StepBadge active={step === 1} done={step > 1} label="Workspace" />
        <StepBadge active={step === 2} done={step > 2} label="Identity" />
        <StepBadge active={step === 3} done={false} label="Bank & finish" />
      </div>

      {step === 1 && (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="organisationName">Organisation name</Label>
            <Input
              id="organisationName"
              value={organisationName}
              onChange={(e) => setOrganisationName(e.target.value)}
            />
          </div>
          <OrganisationLogoUpload
            storagePath={logoStoragePath}
            onStoragePathChange={setLogoStoragePath}
            disabled={submitting}
            requestUploadUrl={(body) =>
              apiFetch('/auth/onboarding/logo/upload-url', {
                method: 'POST',
                accessToken: session?.accessToken,
                body: JSON.stringify(body),
              })
            }
          />
          <div className="space-y-2">
            <Label htmlFor="defaultCurrency">Default currency</Label>
            <Input
              id="defaultCurrency"
              maxLength={3}
              value={defaultCurrency}
              onChange={(e) => setDefaultCurrency(e.target.value.toUpperCase())}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="defaultInterestType">Default interest method</Label>
            <select
              id="defaultInterestType"
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
              value={defaultInterestType}
              onChange={(e) => setDefaultInterestType(e.target.value)}
            >
              <option value={InterestType.FLAT}>Flat rate</option>
              <option value={InterestType.REDUCING}>Reducing balance</option>
            </select>
          </div>
          <Button
            type="button"
            className="w-full"
            disabled={!organisationName.trim()}
            onClick={() => setStep(2)}
          >
            Continue
          </Button>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <KycProfileFields
            idNumber={idNumber}
            address={address}
            onIdNumberChange={setIdNumber}
            onAddressChange={setAddress}
          />
          <KycIdUpload
            accessToken={session?.accessToken}
            onUploaded={() => setIdUploaded(true)}
          />
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => setStep(1)}>
              Back
            </Button>
            <Button
              type="button"
              className="flex-1"
              disabled={idNumber.length !== 13 || address.trim().length < 5 || !idUploaded}
              onClick={() => setStep(3)}
            >
              Continue
            </Button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Link the bank account connected to your lender wallet for disbursements and
            repayments.
          </p>
          <BankDetailsFields
            accountHolder={accountHolder}
            bankName={bankName}
            branchCode={branchCode}
            accountNumber={accountNumber}
            onAccountHolderChange={setAccountHolder}
            onBankNameChange={setBankName}
            onBranchCodeChange={setBranchCode}
            onAccountNumberChange={setAccountNumber}
          />
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => setStep(2)}>
              Back
            </Button>
            <Button
              type="button"
              className="flex-1"
              disabled={
                submitting ||
                !accountHolder ||
                !bankName ||
                branchCode.length !== 6 ||
                accountNumber.length < 6
              }
              onClick={() => void submit()}
            >
              {submitting ? (
                <span className="inline-flex items-center gap-2">
                  <LmsLoaderMark size="sm" showIcon={false} />
                  Saving…
                </span>
              ) : (
                'Complete setup'
              )}
            </Button>
          </div>
        </div>
      )}
    </AuthShell>
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
          ? 'bg-brand-green/15 text-brand-navy font-medium'
          : done
            ? 'bg-muted text-muted-foreground'
            : 'bg-muted/50 text-muted-foreground'
      }`}
    >
      {label}
    </span>
  );
}
