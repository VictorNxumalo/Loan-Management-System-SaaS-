'use client';

import type { SupportTicketDetailDto } from '@lms/types';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { PageHeader } from '@/components/page-header';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

type Props = {
  ticket: SupportTicketDetailDto;
  onReply: (body: string) => Promise<void>;
};

export function UserSupportTicketDetail({ ticket, onReply }: Props) {
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const closed =
    ticket.status === 'RESOLVED' || ticket.status === 'CLOSED';

  const submitReply = async () => {
    if (!message.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      await onReply(message.trim());
      setMessage('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send reply');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={`#${ticket.ticketNumber} — ${ticket.subject}`}
        description={`${ticket.categoryLabel} · ${ticket.statusLabel}`}
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Your request</CardTitle>
          <CardDescription>
            Submitted {new Date(ticket.createdAt).toLocaleString()}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="whitespace-pre-wrap text-sm">{ticket.description}</p>
        </CardContent>
      </Card>

      <div className="space-y-3">
        {ticket.messages.map((entry) => (
          <Card key={entry.id}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">{entry.authorName}</CardTitle>
              <CardDescription>
                {new Date(entry.createdAt).toLocaleString()}
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <p className="whitespace-pre-wrap text-sm">{entry.body}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {!closed && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Add a reply</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="user-reply">Message</Label>
              <textarea
                id="user-reply"
                className="flex min-h-[100px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
                value={message}
                onChange={(event) => setMessage(event.target.value)}
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button size="sm" disabled={submitting} onClick={() => void submitReply()}>
              {submitting ? 'Sending…' : 'Send reply'}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
