'use client';

import type { LoanApplicationDetailDto } from '@lms/types';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ApplicationStatusBadge } from '@/components/application-status-badge';
import { Button } from '@/components/ui/button';
import { useApi } from '@/lib/use-api';

export default function BorrowerApplicationDetailPage() {
  const api = useApi();
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const [application, setApplication] = useState<LoanApplicationDetailDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    void api<LoanApplicationDetailDto>(`/borrower/applications/${params.id}`)
      .then(setApplication)
      .catch((err: Error) => setError(err.message));
  }, [api, params.id]);

  const withdraw = async () => {
    setLoading(true);
    setError(null);
    try {
      const updated = await api<LoanApplicationDetailDto>(
        `/borrower/applications/${params.id}/withdraw`,
        { method: 'POST' },
      );
      setApplication(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not withdraw application');
    } finally {
      setLoading(false);
    }
  };

  if (!application && !error) {
    return <p className="text-muted-foreground">Loading application…</p>;
  }

  if (!application) {
    return <p className="text-sm text-destructive">{error}</p>;
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <Button variant="ghost" size="sm" asChild>
          <Link href="/borrower/applications">← Back to applications</Link>
        </Button>
        <div className="mt-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              Application to {application.organisationName}
            </h1>
            <p className="mt-1 text-muted-foreground">
              Submitted {new Date(application.submittedAt).toLocaleDateString()}
            </p>
          </div>
          <ApplicationStatusBadge status={application.status} />
        </div>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="rounded-lg border bg-background p-6 space-y-4">
        <dl className="grid gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-sm text-muted-foreground">Amount requested</dt>
            <dd className="font-medium">{application.principalFormatted}</dd>
          </div>
          <div>
            <dt className="text-sm text-muted-foreground">Start date</dt>
            <dd className="font-medium">{application.startDate}</dd>
          </div>
          <div>
            <dt className="text-sm text-muted-foreground">Term</dt>
            <dd className="font-medium">{application.termPeriods} periods</dd>
          </div>
          <div>
            <dt className="text-sm text-muted-foreground">Frequency</dt>
            <dd className="font-medium">{application.frequency.replace('_', ' ')}</dd>
          </div>
          <div>
            <dt className="text-sm text-muted-foreground">Interest method</dt>
            <dd className="font-medium">{application.interestType.replace('_', ' ')}</dd>
          </div>
        </dl>

        {application.purpose && (
          <div>
            <p className="text-sm text-muted-foreground">Purpose</p>
            <p className="mt-1">{application.purpose}</p>
          </div>
        )}

        {application.lenderNotes && (
          <div>
            <p className="text-sm text-muted-foreground">Lender response</p>
            <p className="mt-1">{application.lenderNotes}</p>
          </div>
        )}

        {application.status === 'APPROVED' && application.loanId && (
          <p className="text-sm text-green-700">
            Your application was approved. The lender will activate your loan from their
            dashboard.
          </p>
        )}
      </div>

      {application.status === 'SUBMITTED' && (
        <Button variant="outline" disabled={loading} onClick={() => void withdraw()}>
          {loading ? 'Withdrawing…' : 'Withdraw application'}
        </Button>
      )}

      {application.status === 'APPROVED' && (
        <Button variant="outline" onClick={() => router.push('/borrower/applications')}>
          Done
        </Button>
      )}
    </div>
  );
}
