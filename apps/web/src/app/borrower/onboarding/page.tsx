'use client';

import type { AuthMeResponse } from '@lms/types';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { AuthShell } from '@/components/brand/auth-shell';
import { PageLoading } from '@/components/brand/loading';
import { LmsLoaderMark } from '@/components/brand/logo';
import { BankDetailsFields, KycProfileFields } from '@/components/kyc-profile-fields';
import { KycIdUpload } from '@/components/kyc-id-upload';
import { Button } from '@/components/ui/button';
import { apiFetch } from '@/lib/api';

export default function BorrowerOnboardingPage() {
  const { data: session, status, update } = useSession();
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [idUploaded, setIdUploaded] = useState(false);

  const [phone, setPhone] = useState('');
  const [idNumber, setIdNumber] = useState('');
  const [address, setAddress] = useState('');
  const [accountHolder, setAccountHolder] = useState('');
  const [bankName, setBankName] = useState('');
  const [branchCode, setBranchCode] = useState('');
  const [accountNumber, setAccountNumber] = useState('');

  useEffect(() => {
    if (status !== 'authenticated' || !session?.accessToken) {
      return;
    }

    if (session.user.profileComplete) {
      router.replace('/borrower');
      return;
    }

    let cancelled = false;

    void (async () => {
      try {
        const me = await apiFetch<AuthMeResponse>('/auth/me', {
          accessToken: session.accessToken,
        });
        if (!cancelled && me.user.profileComplete) {
          router.replace('/borrower');
        }
      } catch {
        // layout guard handles auth errors
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
      await apiFetch('/auth/borrower-onboarding', {
        method: 'PATCH',
        accessToken: session.accessToken,
        body: JSON.stringify({
          phone,
          idNumber,
          address,
          bankDetails: { accountHolder, bankName, branchCode, accountNumber },
        }),
      });

      await update();
      router.replace('/borrower');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save your profile');
    } finally {
      setSubmitting(false);
    }
  };

  if (status === 'loading') {
    return <PageLoading label="Loading your profile…" className="min-h-screen" />;
  }

  return (
    <AuthShell
      title="Complete your borrower profile"
      description="One-time verification is required before you can use the platform. Provide your contact details, SA ID copy, address, and bank account for your wallet."
    >
      {error && (
        <p className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </p>
      )}

      <div className="mb-6 flex gap-2 text-xs text-muted-foreground">
        <StepBadge active={step === 1} done={step > 1} label="Details" />
        <StepBadge active={step === 2} done={step > 2} label="ID document" />
        <StepBadge active={step === 3} done={false} label="Bank & finish" />
      </div>

      {step === 1 && (
        <div className="space-y-4">
          <KycProfileFields
            showPhone
            phone={phone}
            idNumber={idNumber}
            address={address}
            onPhoneChange={setPhone}
            onIdNumberChange={setIdNumber}
            onAddressChange={setAddress}
          />
          <Button
            type="button"
            className="w-full"
            disabled={
              phone.trim().length < 7 ||
              idNumber.length !== 13 ||
              address.trim().length < 5
            }
            onClick={() => setStep(2)}
          >
            Continue
          </Button>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
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
              disabled={!idUploaded}
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
            Link the bank account for your borrower wallet — used when you receive loan
            disbursements and make repayments.
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
                  <LmsLoaderMark size="sm" />
                  Saving…
                </span>
              ) : (
                'Complete profile'
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
