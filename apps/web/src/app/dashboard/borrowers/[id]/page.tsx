'use client';

import type { BorrowerDetailDto, PaginatedLoansDto } from '@lms/types';
import {
  BORROWER_DOCUMENT_LABELS,
  BorrowerDocumentType,
} from '@lms/types';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';
import { DocumentUploadPanel } from '@/components/document-upload-panel';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { apiDownload } from '@/lib/api-download';
import { canManageRecords } from '@/lib/permissions';
import { useApi } from '@/lib/use-api';

const borrowerDocumentTypes = Object.values(BorrowerDocumentType).map((value) => ({
  value,
  label: BORROWER_DOCUMENT_LABELS[value],
}));

export default function BorrowerDetailPage() {
  const api = useApi();
  const { data: session } = useSession();
  const canManage = canManageRecords(session?.user?.role ?? undefined);
  const params = useParams<{ id: string }>();
  const [borrower, setBorrower] = useState<BorrowerDetailDto | null>(null);
  const [loans, setLoans] = useState<PaginatedLoansDto | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void Promise.all([
      api<BorrowerDetailDto>(`/borrowers/${params.id}`),
      api<PaginatedLoansDto>(`/loans?borrowerId=${params.id}&page=1&limit=20`),
    ])
      .then(([borrowerData, loanData]) => {
        setBorrower(borrowerData);
        setLoans(loanData);
      })
      .catch((err: Error) => setError(err.message));
  }, [api, params.id]);

  if (error) {
    return <p className="text-destructive">{error}</p>;
  }

  if (!borrower) {
    return <p className="text-muted-foreground">Loading borrower…</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{borrower.fullName}</h1>
          <p className="text-muted-foreground">{borrower.idNumber}</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            disabled={!session?.accessToken}
            onClick={() => {
              if (!session?.accessToken) {
                return;
              }
              void apiDownload(
                `/reports/borrowers/${borrower.id}/statement.pdf`,
                session.accessToken,
                'statement.pdf',
              ).catch((err: Error) => setError(err.message));
            }}
          >
            Download statement PDF
          </Button>
          <Button variant="outline" asChild>
            <Link href={`/dashboard/borrowers/${borrower.id}/edit`}>Edit</Link>
          </Button>
          <Button asChild>
            <Link href={`/dashboard/loans/new?borrowerId=${borrower.id}`}>New loan</Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <SummaryCard title="Total loans" value={String(borrower.summary.totalLoans)} />
        <SummaryCard
          title="Outstanding balance"
          value={borrower.summary.totalOutstandingFormatted}
        />
        <SummaryCard
          title="Loans in arrears"
          value={String(borrower.summary.loansInArrears)}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Contact details</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 text-sm sm:grid-cols-2">
          <p>Phone: {borrower.phone}</p>
          <p>Email: {borrower.email ?? '—'}</p>
          <p>Address: {borrower.address ?? '—'}</p>
          <p>Employer: {borrower.employer ?? '—'}</p>
          <p>
            Monthly income:{' '}
            {borrower.monthlyIncomeFormatted ?? '—'}
          </p>
        </CardContent>
      </Card>

      <DocumentUploadPanel
        entityType="BORROWER"
        entityId={borrower.id}
        documentTypes={borrowerDocumentTypes}
        canManage={canManage}
        title="Borrower documents"
      />

      <Card>
        <CardHeader>
          <CardTitle>Loan history</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="bg-muted/50 text-left">
                <tr>
                  <th className="px-3 py-2">Principal</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Outstanding</th>
                  <th className="px-3 py-2">Start date</th>
                </tr>
              </thead>
              <tbody>
                {loans?.items.map((loan) => (
                  <tr key={loan.id} className="border-t">
                    <td className="px-3 py-2">
                      <Link
                        href={`/dashboard/loans/${loan.id}`}
                        className="text-primary hover:underline"
                      >
                        {loan.principalFormatted}
                      </Link>
                    </td>
                    <td className="px-3 py-2">{loan.status}</td>
                    <td className="px-3 py-2">{loan.outstandingBalanceFormatted}</td>
                    <td className="px-3 py-2">{loan.startDate}</td>
                  </tr>
                ))}
                {loans?.items.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-3 py-8 text-center text-muted-foreground">
                      No loans yet
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function SummaryCard({ title, value }: { title: string; value: string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-semibold">{value}</p>
      </CardContent>
    </Card>
  );
}
