'use client';

import type { BorrowerLendingStatusDto } from '@lms/types';
import Link from 'next/link';
import { useAuthenticatedQuery } from '@/lib/use-authenticated-query';

export function BorrowerLendingStatusBanner() {
  const { data: status } = useAuthenticatedQuery<BorrowerLendingStatusDto>(
    '/borrower/lending-status',
  );

  if (!status?.hasActiveCommitment || !status.message) {
    return null;
  }

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
      <p>{status.message}</p>
      {status.committedOrgId && (
        <p className="mt-2">
          <Link href="/borrower/loans" className="font-medium underline">
            View your loans
          </Link>
        </p>
      )}
    </div>
  );
}
