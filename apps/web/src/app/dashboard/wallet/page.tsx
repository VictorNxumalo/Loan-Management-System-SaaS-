'use client';

import type {
  PaginatedWalletTransactionsDto,
  WalletSummaryDto,
} from '@lms/types';
import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';
import { MoneyInput } from '@/components/money-input';
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
import { canManageRecords } from '@/lib/permissions';
import { useApi } from '@/lib/use-api';

export default function LenderWalletPage() {
  const api = useApi();
  const { data: session } = useSession();
  const canManage = canManageRecords(session?.user?.role ?? undefined);

  const [wallet, setWallet] = useState<WalletSummaryDto | null>(null);
  const [transactions, setTransactions] =
    useState<PaginatedWalletTransactionsDto | null>(null);
  const [accountHolder, setAccountHolder] = useState('');
  const [bankName, setBankName] = useState('');
  const [branchCode, setBranchCode] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [topUpCents, setTopUpCents] = useState<number | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    const [walletData, txData] = await Promise.all([
      api<WalletSummaryDto>('/wallets/me'),
      api<PaginatedWalletTransactionsDto>('/wallets/me/transactions?limit=20&page=1'),
    ]);
    setWallet(walletData);
    setTransactions(txData);
    if (walletData.bankAccount) {
      setAccountHolder(walletData.bankAccount.accountHolder);
      setBankName(walletData.bankAccount.bankName);
      setBranchCode(walletData.bankAccount.branchCode);
    }
  };

  useEffect(() => {
    void load().catch((err: Error) => setError(err.message));
  }, [api]);

  const saveBankAccount = async () => {
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const updated = await api<WalletSummaryDto>('/wallets/me/bank-account', {
        method: 'PUT',
        body: JSON.stringify({
          accountHolder,
          bankName,
          branchCode,
          accountNumber,
        }),
      });
      setWallet(updated);
      setAccountNumber('');
      setMessage('Bank account linked.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save bank account');
    } finally {
      setLoading(false);
    }
  };

  const recordTopUp = async () => {
    if (!topUpCents || topUpCents <= 0) return;
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const updated = await api<WalletSummaryDto>('/wallets/me/top-up', {
        method: 'POST',
        body: JSON.stringify({
          amountCents: topUpCents,
          description: 'Manual demo top-up',
        }),
      });
      setWallet(updated);
      setTopUpCents(null);
      setMessage('Demo top-up recorded (not a real bank transfer).');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not record top-up');
    } finally {
      setLoading(false);
    }
  };

  if (!wallet) {
    return <p className="text-sm text-muted-foreground">Loading wallet…</p>;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Wallet"
        description="Available funds for disbursements and receiving repayments."
      />

      {error && (
        <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </p>
      )}
      {message && (
        <p className="rounded-lg border border-brand-green/30 bg-brand-green/5 px-4 py-3 text-sm text-brand-navy">
          {message}
        </p>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Available balance</CardTitle>
          <CardDescription>Liquid cash linked to your bank account</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-3xl font-bold text-brand-green">
            {wallet.availableBalanceFormatted}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Linked bank account</CardTitle>
          <CardDescription>
            {wallet.bankAccount
              ? `${wallet.bankAccount.bankName} · ${wallet.bankAccount.accountNumberMasked}`
              : 'No bank account linked yet'}
          </CardDescription>
        </CardHeader>
        {canManage && (
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="accountHolder">Account holder</Label>
              <Input
                id="accountHolder"
                value={accountHolder}
                onChange={(e) => setAccountHolder(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bankName">Bank name</Label>
              <Input
                id="bankName"
                value={bankName}
                onChange={(e) => setBankName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="branchCode">Branch code</Label>
              <Input
                id="branchCode"
                value={branchCode}
                onChange={(e) => setBranchCode(e.target.value)}
                placeholder="6 digits"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="accountNumber">Account number</Label>
              <Input
                id="accountNumber"
                value={accountNumber}
                onChange={(e) => setAccountNumber(e.target.value)}
                placeholder={wallet.bankAccount ? 'Enter new number to update' : '6–20 digits'}
              />
            </div>
            <div className="sm:col-span-2">
              <Button onClick={() => void saveBankAccount()} disabled={loading}>
                Save bank account
              </Button>
            </div>
          </CardContent>
        )}
      </Card>

      {canManage && (
        <Card>
          <CardHeader>
            <CardTitle>Record demo top-up</CardTitle>
            <CardDescription>
              Phase 1 only — records a manual ledger entry for testing, not a real bank deposit.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap items-end gap-4">
            <MoneyInput
              id="top-up-amount"
              label="Amount"
              valueCents={topUpCents}
              onChangeCents={setTopUpCents}
            />
            <Button
              onClick={() => void recordTopUp()}
              disabled={loading || !topUpCents || topUpCents <= 0}
            >
              Record top-up
            </Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Transaction history</CardTitle>
        </CardHeader>
        <CardContent>
          <WalletTransactionTable items={transactions?.items ?? []} />
        </CardContent>
      </Card>
    </div>
  );
}

function WalletTransactionTable({
  items,
}: {
  items: PaginatedWalletTransactionsDto['items'];
}) {
  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">No transactions yet</p>;
  }

  return (
    <div className="overflow-x-auto rounded-md border">
      <table className="w-full min-w-[640px] text-sm">
        <thead className="bg-muted/50 text-left">
          <tr>
            <th className="px-3 py-2">Date</th>
            <th className="px-3 py-2">Type</th>
            <th className="px-3 py-2">Amount</th>
            <th className="px-3 py-2">Balance after</th>
            <th className="px-3 py-2">Description</th>
          </tr>
        </thead>
        <tbody>
          {items.map((tx) => (
            <tr key={tx.id} className="border-t">
              <td className="px-3 py-2">{new Date(tx.createdAt).toLocaleString()}</td>
              <td className="px-3 py-2">{tx.type}</td>
              <td className="px-3 py-2">
                {tx.amountCents < 0 ? '−' : '+'}
                {tx.amountFormatted}
              </td>
              <td className="px-3 py-2">{tx.balanceAfterFormatted ?? '—'}</td>
              <td className="px-3 py-2">{tx.description ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
