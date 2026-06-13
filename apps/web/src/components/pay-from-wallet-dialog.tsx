'use client';

import type { PayFromWalletResultDto, WalletSummaryDto } from '@lms/types';
import Link from 'next/link';
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
import { useAuthenticatedQuery } from '@/lib/use-authenticated-query';

export function PayFromWalletDialog({
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
  const walletQuery = useAuthenticatedQuery<WalletSummaryDto>(
    open ? '/borrower/wallet' : null,
  );

  const [amountCents, setAmountCents] = useState<number | null>(null);
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const wallet = walletQuery.data;
  const walletBalanceCents = wallet?.availableBalanceCents ?? 0;

  useEffect(() => {
    if (!open) {
      return;
    }

    setAmountCents(null);
    setPaymentDate(new Date().toISOString().slice(0, 10));
    setNote('');
    setError(null);
    setLoading(false);
  }, [open, loanId]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!amountCents || amountCents <= 0) {
      setError('Enter a valid payment amount');
      return;
    }

    if (amountCents > walletBalanceCents) {
      setError('Amount exceeds your wallet balance');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await api<PayFromWalletResultDto>(`/borrower/loans/${loanId}/pay-from-wallet`, {
        method: 'POST',
        body: JSON.stringify({
          amountCents,
          paymentDate,
          note: note.trim() || undefined,
        }),
      });

      onSubmitted();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not process payment');
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
          <CardTitle>Pay from wallet</CardTitle>
          <CardDescription>
            Transfer funds from your LMS wallet to your lender instantly. Loan
            outstanding: {outstandingFormatted}.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {walletQuery.loading ? (
            <p className="text-sm text-muted-foreground">Loading wallet…</p>
          ) : (
            <>
              <div className="mb-4 rounded-md border bg-muted/20 px-3 py-2 text-sm">
                <p className="text-muted-foreground">Available in wallet</p>
                <p className="text-lg font-semibold">
                  {wallet?.availableBalanceFormatted ?? 'R 0.00'}
                </p>
                {walletBalanceCents === 0 && (
                  <p className="mt-2 text-amber-800">
                    Your wallet is empty. Loan disbursements are credited here, or you
                    can{' '}
                    <Link href="/borrower/wallet" className="font-medium underline">
                      view your wallet
                    </Link>
                    .
                  </p>
                )}
              </div>

              {error && <p className="mb-4 text-sm text-destructive">{error}</p>}

              <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
                <MoneyInput
                  id="wallet-pay-amount"
                  label="Payment amount"
                  valueCents={amountCents}
                  onChangeCents={setAmountCents}
                  required
                />
                <div className="space-y-2">
                  <Label htmlFor="wallet-pay-date">Payment date</Label>
                  <Input
                    id="wallet-pay-date"
                    type="date"
                    required
                    value={paymentDate}
                    onChange={(e) => setPaymentDate(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="wallet-pay-note">Note (optional)</Label>
                  <Input
                    id="wallet-pay-note"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="e.g. Monthly instalment"
                  />
                </div>
                <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                  <Button type="button" variant="outline" disabled={loading} onClick={onClose}>
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    className="w-full sm:w-auto"
                    disabled={loading || walletBalanceCents <= 0}
                  >
                    {loading ? 'Processing…' : 'Pay from wallet'}
                  </Button>
                </div>
              </form>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
