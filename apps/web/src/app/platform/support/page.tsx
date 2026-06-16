'use client';

import type { SupportTicketSummaryDto } from '@lms/types';
import Link from 'next/link';
import { PageHeader } from '@/components/page-header';
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { useAuthenticatedQuery } from '@/lib/use-authenticated-query';

export default function PlatformSupportPage() {
  const { data, error, loading } = useAuthenticatedQuery<SupportTicketSummaryDto[]>(
    '/platform/support/tickets',
  );

  const tickets = data ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="User issues & disputes"
        description="Complaints and support requests from lenders and borrowers across the platform."
      />

      {error && <p className="text-sm text-destructive">{error}</p>}
      {loading && <p className="text-sm text-muted-foreground">Loading issues…</p>}

      <div className="space-y-3">
        {tickets.map((ticket) => (
          <Link key={ticket.id} href={`/platform/support/${ticket.id}`}>
            <Card className="transition hover:border-brand-green/40">
              <CardHeader>
                <CardTitle className="text-base">
                  #{ticket.ticketNumber} — {ticket.subject}
                </CardTitle>
                <CardDescription>
                  {ticket.categoryLabel} · {ticket.statusLabel} · Updated{' '}
                  {new Date(ticket.updatedAt).toLocaleString()}
                </CardDescription>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>

      {!loading && tickets.length === 0 && !error && (
        <p className="text-sm text-muted-foreground">No user issues reported yet.</p>
      )}
    </div>
  );
}
