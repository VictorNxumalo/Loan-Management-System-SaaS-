import type { ProfileBankAccountDto } from '@lms/types';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export function ProfileBankAccountSummary({
  bankAccount,
  profileHref = '/borrower/profile',
  showUpdateLink = true,
}: {
  bankAccount: ProfileBankAccountDto;
  profileHref?: string;
  showUpdateLink?: boolean;
}) {
  return (
    <dl className="grid gap-3 rounded-lg border bg-muted/30 p-4 text-sm sm:grid-cols-2">
      <div className="sm:col-span-2">
        <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Account holder
        </dt>
        <dd className="mt-1 font-medium">{bankAccount.accountHolder}</dd>
      </div>
      <div className="sm:col-span-2">
        <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Bank name
        </dt>
        <dd className="mt-1 font-medium">{bankAccount.bankName}</dd>
      </div>
      <div>
        <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Branch code
        </dt>
        <dd className="mt-1 font-medium">{bankAccount.branchCode}</dd>
      </div>
      <div>
        <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Account number
        </dt>
        <dd className="mt-1 font-medium">{bankAccount.accountNumberMasked}</dd>
      </div>
      {showUpdateLink && (
        <div className="sm:col-span-2">
          <p className="text-xs text-muted-foreground">
            Pulled from your profile wallet.{' '}
            <Link href={profileHref} className="font-medium text-primary hover:underline">
              Update in profile
            </Link>{' '}
            if these details have changed.
          </p>
        </div>
      )}
    </dl>
  );
}

export function ProfileBankAccountMissing({
  profileHref = '/borrower/profile',
}: {
  profileHref?: string;
}) {
  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
      <p className="font-medium">Bank account required</p>
      <p className="mt-1">
        Link a bank account in your profile before you can apply. This keeps your
        disbursement details consistent across the platform.
      </p>
      <Button asChild size="sm" variant="outline" className="mt-3">
        <Link href={profileHref}>Go to profile</Link>
      </Button>
    </div>
  );
}
