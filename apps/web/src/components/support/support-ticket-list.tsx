'use client';

import type { SupportTicketSummaryDto } from '@lms/types';
import Link from 'next/link';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

type Props = {
  tickets: SupportTicketSummaryDto[];
  basePath: string;
};

export function SupportTicketList({ tickets, basePath }: Props) {
  if (tickets.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No issues submitted yet. Use the form above to contact LMS support.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {tickets.map((ticket) => (
        <Link key={ticket.id} href={`${basePath}/${ticket.id}`}>
          <Card className="transition hover:border-brand-green/40">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">
                #{ticket.ticketNumber} — {ticket.subject}
              </CardTitle>
              <CardDescription>
                {ticket.categoryLabel} · {ticket.statusLabel} ·{' '}
                {new Date(ticket.updatedAt).toLocaleString()}
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <p className="text-sm text-muted-foreground">Tap to view conversation</p>
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  );
}
