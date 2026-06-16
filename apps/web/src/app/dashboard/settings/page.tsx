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
  const [typicalLoanMinCents, setTypicalLoanMinCents] = useState<number | null>(null);
  const [typicalLoanMaxCents, setTypicalLoanMaxCents] = useState<number | null>(null);
  const [legalEntityName, setLegalEntityName] = useState('');
  const [ncrRegistrationNumber, setNcrRegistrationNumber] = useState('');
  const [complianceContactEmail, setComplianceContactEmail] = useState('');
  const [logoStoragePath, setLogoStoragePath] = useState<string | null>(null);
  const [pendingLogoPath, setPendingLogoPath] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const marketplaceProfile =
    session?.organisation?.settings?.marketplaceProfile &&
    typeof session.organisation.settings.marketplaceProfile === 'object'
      ? (session.organisation.settings.marketplaceProfile as Record<string, unknown>)
      : {};
  const verificationStatus =
    typeof marketplaceProfile.verificationStatus === 'string'
      ? marketplaceProfile.verificationStatus
      : LenderVerificationStatus.UNVERIFIED;
  const verificationLabel =
    verificationStatus in LENDER_VERIFICATION_STATUS_LABELS
      ? LENDER_VERIFICATION_STATUS_LABELS[
          verificationStatus as keyof typeof LENDER_VERIFICATION_STATUS_LABELS
        ]
      : 'Unverified';
  const verificationReviewedAt =
    typeof marketplaceProfile.verificationReviewedAt === 'string'
      ? marketplaceProfile.verificationReviewedAt
      : null;

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
    if (typeof profile.typicalLoanMinCents === 'number') {
      setTypicalLoanMinCents(profile.typicalLoanMinCents);
    }
    if (typeof profile.typicalLoanMaxCents === 'number') {
      setTypicalLoanMaxCents(profile.typicalLoanMaxCents);
    }

    const compliance =
      settings.lenderComplianceProfile && typeof settings.lenderComplianceProfile === 'object'
        ? (settings.lenderComplianceProfile as Record<string, unknown>)
        : {};
    setLegalEntityName(
      typeof compliance.legalEntityName === 'string' ? compliance.legalEntityName : '',
    );
    setNcrRegistrationNumber(
      typeof compliance.ncrRegistrationNumber === 'string'
        ? compliance.ncrRegistrationNumber
        : '',
    );
    setComplianceContactEmail(
      typeof compliance.complianceContactEmail === 'string'
        ? compliance.complianceContactEmail
        : '',
    );

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
            typicalLoanMinCents: typicalLoanMinCents ?? undefined,
            typicalLoanMaxCents: typicalLoanMaxCents ?? undefined,
          },
          lenderComplianceProfile: {
            legalEntityName: legalEntityName.trim() || undefined,
            ncrRegistrationNumber: ncrRegistrationNumber.trim() || undefined,
            complianceContactEmail: complianceContactEmail.trim() || undefined,
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
          <CardTitle>Trust & verification</CardTitle>
          <CardDescription>
            Verification badges are assigned by LMS after compliance review. They are
            shown to borrowers when browsing lenders.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">Status</span>
            <span className="font-medium">{verificationLabel}</span>
          </div>
          {verificationReviewedAt && (
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Last reviewed</span>
              <span>{new Date(verificationReviewedAt).toLocaleString()}</span>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Compliance profile</CardTitle>
          <CardDescription>
            Used for trust and regulatory onboarding. Verification badges are managed by LMS
            after compliance review.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="legalEntityName">Legal entity name</Label>
            <Input
              id="legalEntityName"
              value={legalEntityName}
              onChange={(event) => setLegalEntityName(event.target.value)}
              placeholder="e.g. Khaya Finance (Pty) Ltd"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ncrRegistrationNumber">NCR registration number</Label>
            <Input
              id="ncrRegistrationNumber"
              value={ncrRegistrationNumber}
              onChange={(event) => setNcrRegistrationNumber(event.target.value)}
              placeholder="e.g. NCRCP12345"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="complianceContactEmail">Compliance contact email</Label>
            <Input
              id="complianceContactEmail"
              type="email"
              value={complianceContactEmail}
              onChange={(event) => setComplianceContactEmail(event.target.value)}
              placeholder="compliance@yourorg.co.za"
            />
          </div>
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
