'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { createBorrowerSchema, type BorrowerDetailDto } from '@lms/types';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import type { z } from 'zod';
import { MoneyInput } from '@/components/money-input';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useApi } from '@/lib/use-api';

type BorrowerForm = z.infer<typeof createBorrowerSchema>;

export default function EditBorrowerPage() {
  const api = useApi();
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors, isSubmitting },
  } = useForm<BorrowerForm>({
    resolver: zodResolver(createBorrowerSchema),
  });

  useEffect(() => {
    void api<BorrowerDetailDto>(`/borrowers/${params.id}`)
      .then((borrower) =>
        reset({
          fullName: borrower.fullName,
          idNumber: borrower.idNumber,
          phone: borrower.phone,
          email: borrower.email ?? '',
          address: borrower.address ?? '',
          employer: borrower.employer ?? '',
          monthlyIncomeCents: borrower.monthlyIncomeCents ?? undefined,
        }),
      )
      .catch((err: Error) => setError(err.message));
  }, [api, params.id, reset]);

  const onSubmit = async (data: BorrowerForm) => {
    setError(null);
    try {
      await api(`/borrowers/${params.id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      });
      router.push(`/dashboard/borrowers/${params.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update borrower');
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader
        backHref={`/dashboard/borrowers/${params.id}`}
        backLabel="Back to borrower"
        title="Edit borrower"
        description="Update contact and profile details"
      />
      <Card>
        <CardHeader>
          <CardTitle>Borrower details</CardTitle>
        </CardHeader>
        <CardContent>
          {error && <p className="mb-4 text-sm text-destructive">{error}</p>}
          <form onSubmit={(e) => void handleSubmit(onSubmit)(e)} className="space-y-4">
            <Field label="Full name" error={errors.fullName?.message}>
              <Input {...register('fullName')} />
            </Field>
            <Field label="ID number" error={errors.idNumber?.message}>
              <Input {...register('idNumber')} />
            </Field>
            <Field label="Phone" error={errors.phone?.message}>
              <Input {...register('phone')} />
            </Field>
            <Field label="Email" error={errors.email?.message}>
              <Input type="email" {...register('email')} />
            </Field>
            <Field label="Address" error={errors.address?.message}>
              <Input {...register('address')} />
            </Field>
            <Field label="Employer" error={errors.employer?.message}>
              <Input {...register('employer')} />
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
                {isSubmitting ? 'Saving…' : 'Save changes'}
              </Button>
              <Button type="button" variant="outline" asChild>
                <Link href={`/dashboard/borrowers/${params.id}`}>Cancel</Link>
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
