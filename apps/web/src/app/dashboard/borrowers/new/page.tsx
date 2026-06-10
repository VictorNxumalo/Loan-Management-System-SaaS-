'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { createBorrowerSchema } from '@lms/types';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useApi } from '@/lib/use-api';

type BorrowerForm = z.infer<typeof createBorrowerSchema>;

export default function NewBorrowerPage() {
  const api = useApi();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<BorrowerForm>({
    resolver: zodResolver(createBorrowerSchema),
  });

  const onSubmit = async (data: BorrowerForm) => {
    setError(null);
    try {
      const borrower = await api<{ id: string }>('/borrowers', {
        method: 'POST',
        body: JSON.stringify(data),
      });
      router.push(`/dashboard/borrowers/${borrower.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create borrower');
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Add borrower</h1>
        <p className="text-muted-foreground">Create a new borrower profile</p>
      </div>

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
            <Field label="Monthly income (cents)" error={errors.monthlyIncomeCents?.message}>
              <Input
                id="monthlyIncomeCents"
                type="number"
                {...register('monthlyIncomeCents', { valueAsNumber: true })}
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
