'use client';

import type { PaymentSubmissionDetailDto } from '@lms/types';
import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useApi } from '@/lib/use-api';

export function LoanBankPaymentReviewPanel({
  loanId,
  canManage,
  onUpdated,
}: {
  loanId: string;
  canManage: boolean;
  onUpdated?: () => void;
}) {
  const api = useApi();
  const [submissions, setSubmissions] = useState<PaymentSubmissionDetailDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectNote, setRejectNote] = useState('');
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await api<PaymentSubmissionDetailDto[]>(
        `/loans/${loanId}/payment-submissions`,
      );
      setSubmissions(rows);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load reported payments');
    } finally {
      setLoading(false);
    }
  }, [api, loanId]);

  useEffect(() => {
    void load();
  }, [load]);

  const confirm = async (submissionId: string) => {
    setActionId(submissionId);
    setError(null);
    try {
      await api(`/payment-submissions/${submissionId}/confirm`, { method: 'POST' });
      await load();
      onUpdated?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not record payment');
    } finally {
      setActionId(null);
    }
  };

  const reject = async (submissionId: string) => {
    if (!rejectNote.trim()) {
      setError('Please provide a reason for rejecting this payment');
      return;
    }

    setActionId(submissionId);
    setError(null);
    try {
      await api(`/payment-submissions/${submissionId}/reject`, {
        method: 'POST',
        body: JSON.stringify({ reviewNote: rejectNote.trim() }),
      });
      setRejectId(null);
      setRejectNote('');
      await load();
      onUpdated?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not reject payment');
    } finally {
      setActionId(null);
    }
  };

  const viewProof = async (submissionId: string) => {
    try {
      const result = await api<{ downloadUrl: string }>(
        `/payment-submissions/${submissionId}/proof/download-url`,
      );
      window.open(result.downloadUrl, '_blank', 'noopener,noreferrer');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not open proof document');
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Reported bank payments</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          When a borrower reports a bank payment, it appears here for you to record or
          reject. Wallet repayments are recorded automatically.
        </p>

        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        {loading ? (
          <p className="text-sm text-muted-foreground">Loading reported payments…</p>
        ) : submissions.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No bank payments waiting for review on this loan.
          </p>
        ) : (
          <div className="space-y-4">
            {submissions.map((submission) => (
              <div key={submission.id} className="rounded-lg border p-4 space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">{submission.amountFormatted}</p>
                    <p className="text-sm text-muted-foreground">
                      Reported by {submission.borrowerName} for {submission.paymentDate}
                    </p>
                    {submission.referenceNote ? (
                      <p className="text-sm text-muted-foreground">
                        Reference: {submission.referenceNote}
                      </p>
                    ) : null}
                  </div>
                  {submission.hasProofDocument ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => void viewProof(submission.id)}
                    >
                      View proof
                    </Button>
                  ) : null}
                </div>

                {canManage ? (
                  rejectId === submission.id ? (
                    <div className="space-y-2 border-t pt-3">
                      <Label htmlFor={`reject-${submission.id}`}>Reason for rejection</Label>
                      <Input
                        id={`reject-${submission.id}`}
                        value={rejectNote}
                        onChange={(e) => setRejectNote(e.target.value)}
                      />
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          disabled={actionId === submission.id}
                          onClick={() => void reject(submission.id)}
                        >
                          Confirm reject
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setRejectId(null);
                            setRejectNote('');
                          }}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-2 border-t pt-3">
                      <Button
                        type="button"
                        size="sm"
                        disabled={actionId === submission.id}
                        onClick={() => void confirm(submission.id)}
                      >
                        {actionId === submission.id ? 'Recording…' : 'Record payment'}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={actionId === submission.id}
                        onClick={() => setRejectId(submission.id)}
                      >
                        Reject
                      </Button>
                    </div>
                  )
                ) : null}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
