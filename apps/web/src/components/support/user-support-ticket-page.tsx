'use client';

import type { SupportTicketDetailDto } from '@lms/types';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { PageLoading } from '@/components/brand/loading';
import { UserSupportTicketDetail } from '@/components/support/user-support-ticket-detail';
import { useApi } from '@/lib/use-api';
import { useAuthenticatedQuery } from '@/lib/use-authenticated-query';

type Props = {
  backHref: string;
};

export function UserSupportTicketPage({ backHref }: Props) {
  const params = useParams<{ id: string }>();
  const api = useApi();
  const ticketId = params.id;

  const { data, error, loading, refetch } = useAuthenticatedQuery<SupportTicketDetailDto>(
    ticketId ? `/support/tickets/${ticketId}` : null,
  );

  if (loading) {
    return <PageLoading label="Loading issue…" />;
  }

  if (error || !data) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-destructive">{error ?? 'Issue not found'}</p>
        <Link href={backHref} className="text-sm text-brand-green hover:underline">
          Back to support
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Link href={backHref} className="text-sm text-brand-green hover:underline">
        ← Back to support
      </Link>
      <UserSupportTicketDetail
        ticket={data}
        onReply={async (body) => {
          await api(`/support/tickets/${ticketId}/messages`, {
            method: 'POST',
            body: JSON.stringify({ body }),
          });
          await refetch({ silent: true });
        }}
      />
    </div>
  );
}
