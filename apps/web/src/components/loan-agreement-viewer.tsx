'use client';

import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { getApiBaseUrl } from '@/lib/api-url';
import { openLoanAgreementHtml } from '@/lib/open-loan-agreement';

export function LoanAgreementViewer({
  loanId,
  borrower = false,
  label = 'Open in new tab',
}: {
  loanId: string;
  borrower?: boolean;
  label?: string;
}) {
  const { data: session } = useSession();
  const [html, setHtml] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const path = borrower
    ? `/borrower/loans/${loanId}/loan-agreement/html`
    : `/loans/${loanId}/loan-agreement/html`;

  useEffect(() => {
    if (!session?.accessToken) {
      setHtml(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    void (async () => {
      try {
        const response = await fetch(`${getApiBaseUrl()}${path}`, {
          headers: {
            Authorization: `Bearer ${session.accessToken}`,
            Accept: 'text/html',
          },
        });

        if (!response.ok) {
          throw new Error('Could not load agreement');
        }

        const content = await response.text();
        if (!cancelled) {
          setHtml(content);
        }
      } catch (err) {
        if (!cancelled) {
          setHtml(null);
          setError(err instanceof Error ? err.message : 'Could not load agreement');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [session?.accessToken, path, loanId]);

  return (
    <div className="space-y-3">
      {loading ? (
        <p className="text-sm text-muted-foreground">Loading agreement…</p>
      ) : html ? (
        <iframe
          title="Loan agreement"
          srcDoc={html}
          className="h-96 w-full rounded-md border bg-white"
          sandbox=""
        />
      ) : (
        <p className="text-sm text-destructive">
          {error ?? 'Agreement preview unavailable.'}
        </p>
      )}

      {session?.accessToken ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => void openLoanAgreementHtml(path, session.accessToken!)}
        >
          {label}
        </Button>
      ) : null}
    </div>
  );
}
