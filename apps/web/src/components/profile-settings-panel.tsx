'use client';

import type { UserProfileDto } from '@lms/types';
import { useSession } from 'next-auth/react';
import { useCallback, useEffect, useState } from 'react';
import { KycIdUpload } from '@/components/kyc-id-upload';
import { BankDetailsFields, KycProfileFields } from '@/components/kyc-profile-fields';
import { ProfileBankAccountSummary } from '@/components/profile-bank-account-summary';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { useApi } from '@/lib/use-api';

type EditSection = 'personal' | 'id' | 'bank' | null;

export function ProfileSettingsPanel({
  showPhone,
  profileHref,
  onSaved,
}: {
  showPhone?: boolean;
  /** Profile page path for bank summary helper links */
  profileHref?: string;
  onSaved?: () => void;
}) {
  const api = useApi();
  const { data: session, update } = useSession();
  const [profile, setProfile] = useState<UserProfileDto | null>(null);
  const [editingSection, setEditingSection] = useState<EditSection>(null);
  const [phone, setPhone] = useState('');
  const [idNumber, setIdNumber] = useState('');
  const [address, setAddress] = useState('');
  const [accountHolder, setAccountHolder] = useState('');
  const [bankName, setBankName] = useState('');
  const [branchCode, setBranchCode] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const resetDraftFromProfile = useCallback((data: UserProfileDto) => {
    setPhone(data.phone ?? '');
    setIdNumber(data.idNumber ?? '');
    setAddress(data.address ?? '');
    setAccountHolder(data.bankAccount?.accountHolder ?? '');
    setBankName(data.bankAccount?.bankName ?? '');
    setBranchCode(data.bankAccount?.branchCode ?? '');
    setAccountNumber('');
  }, []);

  const load = useCallback(async () => {
    const data = await api<UserProfileDto>('/auth/profile');
    setProfile(data);
    resetDraftFromProfile(data);
  }, [api, resetDraftFromProfile]);

  useEffect(() => {
    void load().catch((err: Error) => setError(err.message));
  }, [load]);

  const startEditing = (section: Exclude<EditSection, null>) => {
    if (!profile) {
      return;
    }
    resetDraftFromProfile(profile);
    setEditingSection(section);
    setError(null);
    setMessage(null);
  };

  const cancelEditing = () => {
    if (profile) {
      resetDraftFromProfile(profile);
    }
    setEditingSection(null);
    setError(null);
  };

  const savePersonal = async () => {
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const updated = await api<UserProfileDto>('/auth/profile', {
        method: 'PATCH',
        body: JSON.stringify({
          ...(showPhone ? { phone } : {}),
          idNumber,
          address,
        }),
      });
      setProfile(updated);
      resetDraftFromProfile(updated);
      setEditingSection(null);
      await update();
      setMessage('Personal information updated.');
      onSaved?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save personal information');
    } finally {
      setLoading(false);
    }
  };

  const saveBank = async () => {
    if (!accountNumber) {
      setError('Enter your account number to save bank details');
      return;
    }

    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const updated = await api<UserProfileDto>('/auth/profile', {
        method: 'PATCH',
        body: JSON.stringify({
          bankDetails: { accountHolder, bankName, branchCode, accountNumber },
        }),
      });
      setProfile(updated);
      resetDraftFromProfile(updated);
      setEditingSection(null);
      await update();
      setMessage('Bank account updated.');
      onSaved?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save bank account');
    } finally {
      setLoading(false);
    }
  };

  const handleIdUploaded = async () => {
    await load();
    setEditingSection(null);
    setMessage('ID document updated.');
    onSaved?.();
  };

  if (!profile) {
    return <p className="text-sm text-muted-foreground">Loading profile…</p>;
  }

  const bankProfileHref =
    profileHref ?? (showPhone ? '/borrower/profile' : '/dashboard/profile');

  return (
    <div className="space-y-6">
      {error && (
        <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </p>
      )}
      {message && (
        <p className="rounded-lg border border-brand-green/30 bg-brand-green/5 px-4 py-3 text-sm text-brand-navy">
          {message}
        </p>
      )}

      {!profile.profileComplete && profile.missingRequirements.length > 0 && (
        <Card className="border-amber-200 bg-amber-50">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Profile incomplete</CardTitle>
            <CardDescription>
              Complete the following to use the platform:{' '}
              {profile.missingRequirements.join(', ')}. Use Edit on each section below.
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>Personal information</CardTitle>
            <CardDescription>Your identity and contact details on the platform</CardDescription>
          </div>
          {editingSection !== 'personal' && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => startEditing('personal')}
            >
              Edit
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {editingSection === 'personal' ? (
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <KycProfileFields
                  showPhone={showPhone}
                  phone={phone}
                  idNumber={idNumber}
                  address={address}
                  onPhoneChange={setPhone}
                  onIdNumberChange={setIdNumber}
                  onAddressChange={setAddress}
                  disabled={loading}
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button disabled={loading} onClick={() => void savePersonal()}>
                  {loading ? 'Saving…' : 'Save changes'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={loading}
                  onClick={cancelEditing}
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <dl className="grid gap-4 sm:grid-cols-2">
              {showPhone && (
                <ProfileDetailItem label="Phone number" value={profile.phone ?? 'Not set'} />
              )}
              <ProfileDetailItem label="SA ID number" value={profile.idNumber ?? 'Not set'} />
              <ProfileDetailItem
                label="Physical address"
                value={profile.address ?? 'Not set'}
                className="sm:col-span-2"
              />
            </dl>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>ID document</CardTitle>
            <CardDescription>
              Used automatically when you apply for loans — not uploaded per application
            </CardDescription>
          </div>
          {editingSection !== 'id' && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => startEditing('id')}
            >
              {profile.idDocument ? 'Replace' : 'Upload'}
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {editingSection === 'id' ? (
            <div className="space-y-4">
              <KycIdUpload
                accessToken={session?.accessToken}
                uploadedFilename={profile.idDocument?.originalFilename}
                disabled={loading}
                onUploaded={() => void handleIdUploaded()}
              />
              <Button type="button" variant="outline" disabled={loading} onClick={cancelEditing}>
                Cancel
              </Button>
            </div>
          ) : profile.idDocument ? (
            <dl>
              <ProfileDetailItem
                label="Document on file"
                value={profile.idDocument.originalFilename}
              />
              <ProfileDetailItem
                label="Type"
                value={profile.idDocument.documentTypeLabel}
              />
            </dl>
          ) : (
            <p className="text-sm text-muted-foreground">
              No ID document on file. Click Upload to add your SA ID.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>Bank account</CardTitle>
            <CardDescription>Linked to your platform wallet for disbursements and repayments</CardDescription>
          </div>
          {editingSection !== 'bank' && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => startEditing('bank')}
            >
              Edit
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {editingSection === 'bank' ? (
            <div className="space-y-4">
              <BankDetailsFields
                accountHolder={accountHolder}
                bankName={bankName}
                branchCode={branchCode}
                accountNumber={accountNumber}
                onAccountHolderChange={setAccountHolder}
                onBankNameChange={setBankName}
                onBranchCodeChange={setBranchCode}
                onAccountNumberChange={setAccountNumber}
                disabled={loading}
                accountNumberPlaceholder={
                  profile.bankAccount
                    ? 'Re-enter full account number to confirm'
                    : undefined
                }
              />
              <div className="flex flex-wrap gap-2">
                <Button disabled={loading} onClick={() => void saveBank()}>
                  {loading ? 'Saving…' : 'Save changes'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={loading}
                  onClick={cancelEditing}
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : profile.bankAccount ? (
            <ProfileBankAccountSummary
              bankAccount={profile.bankAccount}
              profileHref={bankProfileHref}
              showUpdateLink={false}
            />
          ) : (
            <p className="text-sm text-muted-foreground">
              No bank account linked. Click Edit to add your details.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ProfileDetailItem({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-1 text-sm font-medium">{value}</dd>
    </div>
  );
}
