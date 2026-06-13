'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import type { PlatformBorrowerSearchResultDto } from '@lms/types';
import { createBorrowerSchema } from '@lms/types';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import type { z } from 'zod';
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
import { useApi } from '@/lib/use-api';

type BorrowerForm = z.infer<typeof createBorrowerSchema>;

export default function NewBorrowerPage() {
  const api = useApi();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<PlatformBorrowerSearchResultDto[] | null>(
    null,
  );
  const [linkedUser, setLinkedUser] =
    useState<PlatformBorrowerSearchResultDto | null>(null);

  const {
    register,
    handleSubmit,
    control,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<BorrowerForm>({
    resolver: zodResolver(createBorrowerSchema),
  });

  // Debounced platform borrower search
  useEffect(() => {
    const q = searchTerm.trim();
    if (q.length < 2) {
      setResults(null);
      setSearching(false);
      return;
    }

    setSearching(true);
    const timer = setTimeout(() => {
      api<PlatformBorrowerSearchResultDto[]>(
        `/borrowers/platform-search?q=${encodeURIComponent(q)}`,
      )
        .then((rows) => setResults(rows))
        .catch(() => setResults([]))
        .finally(() => setSearching(false));
    }, 350);

    return () => clearTimeout(timer);
  }, [searchTerm, api]);

  const selectPlatformUser = (user: PlatformBorrowerSearchResultDto) => {
    setLinkedUser(user);
    setResults(null);
    setSearchTerm('');
    setValue('fullName', user.name, { shouldValidate: true });
    setValue('email', user.email, { shouldValidate: true });
    if (user.phone) {
      setValue('phone', user.phone, { shouldValidate: true });
    }
    if (user.idNumber) {
      setValue('idNumber', user.idNumber, { shouldValidate: true });
    }
  };

  const clearLinkedUser = () => {
    setLinkedUser(null);
  };

  const onSubmit = async (data: BorrowerForm) => {
    setError(null);
    try {
      const borrower = await api<{ id: string }>('/borrowers', {
        method: 'POST',
        body: JSON.stringify({
          ...data,
          ...(linkedUser ? { platformUserId: linkedUser.userId } : {}),
        }),
      });
      router.push(`/dashboard/borrowers/${borrower.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create borrower');
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader
        backHref="/dashboard/borrowers"
        backLabel="Back to borrowers"
        title="Add borrower"
        description="Create a new borrower profile"
      />

      <Card>
        <CardHeader>
          <CardTitle>Find a registered borrower</CardTitle>
          <CardDescription>
            Search borrowers connected to your organisation by name, email, or ID
            number — selecting one fills the form automatically and links their
            account so they can see their loans.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input
            placeholder="e.g. Jane Dlamini or 9001015009087"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
          />

          {searching && (
            <p className="text-sm text-muted-foreground">Searching…</p>
          )}

          {results && results.length === 0 && !searching && (
            <p className="text-sm text-muted-foreground">
              No connected platform borrowers match. You can still fill the form
              manually below.
            </p>
          )}

          {results && results.length > 0 && (
            <div className="divide-y rounded-md border">
              {results.map((user) => (
                <div
                  key={user.userId}
                  className="flex flex-wrap items-center justify-between gap-2 p-3"
                >
                  <div>
                    <p className="text-sm font-medium">{user.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {user.email}
                      {user.phone ? ` · ${user.phone}` : ''}
                      {user.idNumber ? ` · ID ${user.idNumber}` : ''}
                    </p>
                  </div>
                  {user.existingBorrowerId ? (
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/dashboard/borrowers/${user.existingBorrowerId}`}>
                        Already added — view
                      </Link>
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      type="button"
                      onClick={() => selectPlatformUser(user)}
                    >
                      Use details
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}

          {linkedUser && (
            <div className="flex items-center justify-between rounded-md bg-primary/5 p-3">
              <p className="text-sm">
                Linked to platform account <strong>{linkedUser.name}</strong> (
                {linkedUser.email})
              </p>
              <Button
                variant="outline"
                size="sm"
                type="button"
                onClick={clearLinkedUser}
              >
                Unlink
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Borrower details</CardTitle>
        </CardHeader>
        <CardContent>
          {error && <p className="mb-4 text-sm text-destructive">{error}</p>}
          <form onSubmit={(e) => void handleSubmit(onSubmit)(e)} className="space-y-4">
            <Field label="Full name" error={errors.fullName?.message}>
              <Input id="fullName" {...register('fullName')} />
            </Field>
            <Field label="ID number" error={errors.idNumber?.message}>
              <Input id="idNumber" {...register('idNumber')} />
            </Field>
            <Field label="Phone" error={errors.phone?.message}>
              <Input id="phone" {...register('phone')} />
            </Field>
            <Field label="Email" error={errors.email?.message}>
              <Input id="email" type="email" {...register('email')} />
            </Field>
            <Field label="Address" error={errors.address?.message}>
              <Input id="address" {...register('address')} />
            </Field>
            <Field label="Employer" error={errors.employer?.message}>
              <Input id="employer" {...register('employer')} />
            </Field>
            <Field label="Monthly income" error={errors.monthlyIncomeCents?.message}>
              <Controller
                name="monthlyIncomeCents"
                control={control}
                render={({ field }) => (
                  <MoneyInput
                    id="monthlyIncome"
                    label=""
                    valueCents={field.value ?? null}
                    onChangeCents={(cents) => field.onChange(cents ?? undefined)}
                    className="space-y-0"
                  />
                )}
              />
            </Field>
            <div className="flex gap-3">
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Saving…' : 'Create borrower'}
              </Button>
              <Button type="button" variant="outline" asChild>
                <Link href="/dashboard/borrowers">Cancel</Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
