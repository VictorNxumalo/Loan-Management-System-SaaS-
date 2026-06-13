'use client';

import type { DocumentUploadUrlDto, PaymentSubmissionDetailDto } from '@lms/types';
import { useEffect, useState } from 'react';
import { MoneyInput } from '@/components/money-input';
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

const MAX_BYTES = 10 * 1024 * 1024;

export function PayLenderDialog({
  loanId,
  outstandingFormatted,
  open,
  onClose,
  onSubmitted,
}: {
  loanId: string;
  outstandingFormatted: string;
  open: boolean;
  onClose: () => void;
  onSubmitted: () => void;
}) {
  const api = useApi();
  const [amountCents, setAmountCents] = useState<number | null>(null);
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10));
  const [referenceNote, setReferenceNote] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) {
      return;
    }

    setAmountCents(null);
    setPaymentDate(new Date().toISOString().slice(0, 10));
    setReferenceNote('');
    setFile(null);
    setError(null);
    setLoading(false);
  }, [open, loanId]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!file) {
      setError('Upload proof of payment (PDF or image)');
      return;
    }
    if (file.size > MAX_BYTES) {
      setError('File must be 10 MB or smaller');
      return;
    }

    if (!amountCents || amountCents <= 0) {
      setError('Enter a valid payment amount');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const submission = await api<PaymentSubmissionDetailDto>(
        `/borrower/loans/${loanId}/payment-submissions`,
        {
          method: 'POST',
          body: JSON.stringify({
            amountCents,
            paymentDate,
            referenceNote: referenceNote.trim() || undefined,
          }),
        },
      );

      const uploadMeta = await api<DocumentUploadUrlDto>(
        `/borrower/loans/${loanId}/payment-submissions/${submission.id}/proof/upload-url`,
        {
          method: 'POST',
          body: JSON.stringify({
            filename: file.name,
            contentType: file.type || 'application/octet-stream',
            sizeBytes: file.size,
          }),
        },
      );

      const uploadResponse = await fetch(uploadMeta.uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type || 'application/octet-stream' },
        body: file,
      });

      if (!uploadResponse.ok) {
        throw new Error('Upload to storage failed');
      }

      await api<PaymentSubmissionDetailDto>(
        `/borrower/loans/${loanId}/payment-submissions/${submission.id}/submit`,
        { method: 'POST' },
      );

      onSubmitted();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not submit payment');
    } finally {
      setLoading(false);
    }
  };

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4">
      <Card className="max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-b-none sm:rounded-b-xl sm:shadow-xl">
        <CardHeader>
          <CardTitle>Report bank payment</CardTitle>
          <CardDescription>
            Use this if you already paid your lender from your bank account outside
            the app. Your lender will review your proof before recording the
            repayment. Outstanding balance: {outstandingFormatted}.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error && <p className="mb-4 text-sm text-destructive">{error}</p>}
          <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
            <MoneyInput
              id="pay-amount"
              label="Payment amount"
              valueCents={amountCents}
              onChangeCents={setAmountCents}
              required
            />
            <div className="space-y-2">
              <Label htmlFor="pay-date">Payment date</Label>
              <Input
                id="pay-date"
                type="date"
                required
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pay-ref">Reference / note (optional)</Label>
              <Input
                id="pay-ref"
                value={referenceNote}
                onChange={(e) => setReferenceNote(e.target.value)}
                placeholder="e.g. EFT ref 12345"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pay-proof">Proof of payment</Label>
              <Input
                id="pay-proof"
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/*"
                onChange={(e) => {
                  setError(null);
                  setFile(e.target.files?.[0] ?? null);
                }}
              />
              {file ? (
                <p className="text-xs text-foreground">
                  Selected: {file.name} ({(file.size / 1024).toFixed(1)} KB)
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Bank transfer receipt, deposit slip, or screenshot (max 10 MB)
                </p>
              )}
            </div>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button type="button" variant="outline" disabled={loading} onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" className="w-full sm:w-auto" disabled={loading}>
                {loading ? 'Submitting…' : 'Submit to lender'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
