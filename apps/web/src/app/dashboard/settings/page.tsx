'use client';

import {
  LENDER_MARKETPLACE_CATEGORY_LABELS,
  LENDER_VERIFICATION_STATUS_LABELS,
  LenderMarketplaceCategory,
  LenderVerificationStatus,
} from '@lms/types';
import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';
import { MoneyInput } from '@/components/money-input';
import { OrganisationLogoUpload } from '@/components/organisation-logo-upload';
import { PageHeader } from '@/components/page-header';
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

export default function SettingsPage() {
  const api = useApi();
  const { data: session, update } = useSession();
  const [publicListing, setPublicListing] = useState(true);
  const [category, setCategory] = useState<string>(LenderMarketplaceCategory.OTHER);
  const [description, setDescription] = useState('');
  const [verificationStatus, setVerificationStatus] = useState<string>(
    LenderVerificationStatus.UNVERIFIED,
  );
  const [typicalLoanMinCents, setTypicalLoanMinCents] = useState<number | null>(null);
  const [typicalLoanMaxCents, setTypicalLoanMaxCents] = useState<number | null>(null);
  const [logoStoragePath, setLogoStoragePath] = useState<string | null>(null);
  const [pendingLogoPath, setPendingLogoPath] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const settings = session?.organisation?.settings ?? {};
    setPublicListing(settings.publicListing !== false);

    const profile =
      settings.marketplaceProfile && typeof settings.marketplaceProfile === 'object'
        ? (settings.marketplaceProfile as Record<string, unknown>)
        : {};

    if (typeof profile.category === 'string') {
      setCategory(profile.category);
    }
    if (typeof profile.description === 'string') {
      setDescription(profile.description);
    }
    if (typeof profile.verificationStatus === 'string') {
      setVerificationStatus(profile.verificationStatus);
    }
    if (typeof profile.typicalLoanMinCents === 'number') {
      setTypicalLoanMinCents(profile.typicalLoanMinCents);
    }
    if (typeof profile.typicalLoanMaxCents === 'number') {
      setTypicalLoanMaxCents(profile.typicalLoanMaxCents);
    }

    const storedLogo =
      typeof settings.logoStoragePath === 'string' ? settings.logoStoragePath : null;
    setLogoStoragePath(storedLogo);
    setPendingLogoPath(storedLogo);
  }, [session]);

  const saveListing = async () => {
    setError(null);
    setMessage(null);
    try {
      await api('/settings/organisation', {
        method: 'PATCH',
        body: JSON.stringify({
          publicListing,
          marketplaceProfile: {
            category,
            description: description.trim() || undefined,
            verificationStatus,
            typicalLoanMinCents: typicalLoanMinCents ?? undefined,
            typicalLoanMaxCents: typicalLoanMaxCents ?? undefined,
          },
          ...(pendingLogoPath !== logoStoragePath
            ? { logoStoragePath: pendingLogoPath ?? '' }
            : {}),
        }),
      });
      await update();
      setLogoStoragePath(pendingLogoPath);
      setMessage('Organisation settings saved.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save settings');
    }
  };

  const sendInvite = async () => {
    setError(null);
    setMessage(null);
    try {
      const result = await api<{ message: string }>('/settings/invites', {
        method: 'POST',
        body: JSON.stringify({ email: inviteEmail }),
      });
      setMessage(result.message);
      setInviteEmail('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send invite');
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        description={`Manage how borrowers discover and connect with ${session?.organisation?.name}.`}
      />

      {error && <p className="text-sm text-destructive">{error}</p>}
      {message && <p className="text-sm text-green-700">{message}</p>}

      <Card>
        <CardHeader>
          <CardTitle>Branding</CardTitle>
          <CardDescription>Your logo appears when borrowers browse lenders.</CardDescription>
        </CardHeader>
        <CardContent>
          <OrganisationLogoUpload
            storagePath={pendingLogoPath}
            onStoragePathChange={setPendingLogoPath}
            requestUploadUrl={(body) =>
              api('/settings/organisation/logo/upload-url', {
                method: 'POST',
                body: JSON.stringify(body),
              })
            }
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Public lender directory</CardTitle>
          <CardDescription>
            Listed by default so borrowers can find you. Turn off if you only work via
            private invites.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={publicListing}
              onChange={(event) => setPublicListing(event.target.checked)}
            />
            List our organisation publicly
          </label>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Marketplace profile</CardTitle>
          <CardDescription>
            How borrowers see you when browsing lenders. Your SaaS billing plan is not
            shown publicly.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="category">Lender category</Label>
            <select
              id="category"
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
              value={category}
              onChange={(event) => setCategory(event.target.value)}
            >
              {Object.entries(LENDER_MARKETPLACE_CATEGORY_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="description">Short description</Label>
            <Input
              id="description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="e.g. Personal loans for salaried workers in Gauteng"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="verificationStatus">Verification status</Label>
            <select
              id="verificationStatus"
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
              value={verificationStatus}
              onChange={(event) => setVerificationStatus(event.target.value)}
            >
              {Object.entries(LENDER_VERIFICATION_STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          <MoneyInput
            id="typicalLoanMin"
            label="Typical minimum"
            valueCents={typicalLoanMinCents}
            onChangeCents={setTypicalLoanMinCents}
          />

          <MoneyInput
            id="typicalLoanMax"
            label="Typical maximum"
            valueCents={typicalLoanMaxCents}
            onChangeCents={setTypicalLoanMaxCents}
          />

          <div className="md:col-span-2">
            <Button onClick={() => void saveListing()}>Save settings</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Invite a borrower</CardTitle>
          <CardDescription>
            Send a private invite link to someone who wants to borrow from you.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="inviteEmail">Borrower email</Label>
            <Input
              id="inviteEmail"
              type="email"
              value={inviteEmail}
              onChange={(event) => setInviteEmail(event.target.value)}
            />
          </div>
          <Button onClick={() => void sendInvite()} disabled={!inviteEmail}>
            Send invite
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
