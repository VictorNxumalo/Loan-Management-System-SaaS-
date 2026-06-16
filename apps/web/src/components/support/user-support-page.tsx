'use client';

import type {
  CreateSupportTicketInput,
  SupportTicketDetailDto,
  SupportTicketSummaryDto,
} from '@lms/types';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { PageHeader } from '@/components/page-header';
import { SupportTicketForm } from '@/components/support/support-ticket-form';
import { SupportTicketList } from '@/components/support/support-ticket-list';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { useApi } from '@/lib/use-api';
import { useAuthenticatedQuery } from '@/lib/use-authenticated-query';

type Props = {
  basePath: string;
  audience: 'lender' | 'borrower';
};

export function UserSupportPage({ basePath, audience }: Props) {
  const api = useApi();
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const { data, error, loading, refetch } = useAuthenticatedQuery<
    SupportTicketSummaryDto[]
  >('/support/tickets');

  const submitTicket = async (input: CreateSupportTicketInput) => {
    const created = await api<SupportTicketDetailDto>('/support/tickets', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    setMessage('Your issue was sent to LMS. We will email you when there is an update.');
    await refetch({ silent: true });
    router.push(`${basePath}/${created.id}`);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Contact LMS"
        description={
          audience === 'borrower'
            ? 'Report a problem with the platform, a lender, or your account to the LMS team.'
            : 'Report billing, compliance, technical, or dispute issues to the LMS platform team.'
        }
      />

      {message && <p className="text-sm text-green-700">{message}</p>}
      {error && <p className="text-sm text-destructive">{error}</p>}

      <Card>
        <CardHeader>
          <CardTitle>Submit an issue</CardTitle>
          <CardDescription>
            Complaints and disputes are reviewed by LMS platform operators, not your
            lender.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SupportTicketForm onSubmit={submitTicket} />
        </CardContent>
      </Card>

      <div className="space-y-3">
        <h2 className="text-lg font-semibold">Your previous issues</h2>
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : (
          <SupportTicketList tickets={data ?? []} basePath={basePath} />
        )}
      </div>
    </div>
  );
}
