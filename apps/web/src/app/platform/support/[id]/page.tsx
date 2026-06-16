'use client';

import type { SupportTicketDetailDto } from '@lms/types';
import {
  SUPPORT_TICKET_STATUS_LABELS,
  type SupportTicketStatus,
} from '@lms/types';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { PageLoading } from '@/components/brand/loading';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { useApi } from '@/lib/use-api';
import { useAuthenticatedQuery } from '@/lib/use-authenticated-query';

export default function PlatformSupportTicketPage() {
  const params = useParams<{ id: string }>();
  const api = useApi();
  const ticketId = params.id;

  const { data, error, loading, refetch } = useAuthenticatedQuery<SupportTicketDetailDto>(
    ticketId ? `/platform/support/tickets/${ticketId}` : null,
  );

  const [statusDraft, setStatusDraft] = useState<SupportTicketStatus | null>(null);
  const [resolutionDraft, setResolutionDraft] = useState<string | null>(null);
  const [reply, setReply] = useState('');
  const [internalNote, setInternalNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  if (loading) {
    return <PageLoading label="Loading issue…" />;
  }

  if (error || !data) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-destructive">{error ?? 'Issue not found'}</p>
        <Link href="/platform/support" className="text-sm text-brand-green hover:underline">
          Back to issues
        </Link>
      </div>
    );
  }

  const ticket = data;
  const currentStatus = statusDraft ?? ticket.status;
  const currentResolution = resolutionDraft ?? ticket.resolutionNote ?? '';

  const saveStatus = async () => {
    setSaving(true);
    setActionError(null);
    setMessage(null);
    try {
      await api(`/platform/support/tickets/${ticketId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          status: currentStatus,
          resolutionNote: currentResolution.trim() || undefined,
        }),
      });
      setMessage('Ticket status updated.');
      await refetch({ silent: true });
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Could not update status');
    } finally {
      setSaving(false);
    }
  };

  const sendReply = async (isInternal: boolean) => {
    const body = isInternal ? internalNote : reply;
    if (!body.trim()) return;

    setSaving(true);
    setActionError(null);
    setMessage(null);
    try {
      await api(`/platform/support/tickets/${ticketId}/messages`, {
        method: 'POST',
        body: JSON.stringify({ body: body.trim(), isInternal }),
      });
      if (isInternal) {
        setInternalNote('');
        setMessage('Internal note added.');
      } else {
        setReply('');
        setMessage('Reply sent to user by email.');
      }
      await refetch({ silent: true });
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Could not send message');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <Link href="/platform/support" className="text-sm text-brand-green hover:underline">
        ← Back to issues
      </Link>

      <PageHeader
        title={`#${ticket.ticketNumber} — ${ticket.subject}`}
        description={`${ticket.categoryLabel} · ${ticket.reporterName} (${ticket.reporterType})`}
      />

      {actionError && <p className="text-sm text-destructive">{actionError}</p>}
      {message && <p className="text-sm text-green-700">{message}</p>}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Reporter</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 text-sm">
          <p>{ticket.reporterName}</p>
          <p className="text-muted-foreground">{ticket.reporterEmail}</p>
          {ticket.organisationName && (
            <p className="text-muted-foreground">Organisation: {ticket.organisationName}</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Original request</CardTitle>
          <CardDescription>{new Date(ticket.createdAt).toLocaleString()}</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="whitespace-pre-wrap text-sm">{ticket.description}</p>
        </CardContent>
      </Card>

      <div className="space-y-3">
        {ticket.messages.map((entry) => (
          <Card
            key={entry.id}
            className={entry.isInternal ? 'border-dashed border-amber-300 bg-amber-50/40' : ''}
          >
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">
                {entry.authorName}
                {entry.isInternal ? ' (internal note)' : ''}
              </CardTitle>
              <CardDescription>{new Date(entry.createdAt).toLocaleString()}</CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <p className="whitespace-pre-wrap text-sm">{entry.body}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Reply to user</CardTitle>
            <CardDescription>User receives an email with your message.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <textarea
              className="flex min-h-[100px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
              value={reply}
              onChange={(event) => setReply(event.target.value)}
            />
            <Button size="sm" disabled={saving} onClick={() => void sendReply(false)}>
              Send reply
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Internal note</CardTitle>
            <CardDescription>Visible only to platform operators.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <textarea
              className="flex min-h-[100px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
              value={internalNote}
              onChange={(event) => setInternalNote(event.target.value)}
            />
            <Button
              size="sm"
              variant="outline"
              disabled={saving}
              onClick={() => void sendReply(true)}
            >
              Add internal note
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Status & resolution</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="ticket-status">Status</Label>
            <select
              id="ticket-status"
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
              value={currentStatus}
              onChange={(event) =>
                setStatusDraft(event.target.value as SupportTicketStatus)
              }
            >
              {Object.entries(SUPPORT_TICKET_STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="resolution-note">Resolution note</Label>
            <Input
              id="resolution-note"
              value={currentResolution}
              onChange={(event) => setResolutionDraft(event.target.value)}
              placeholder="Summary shown when resolving the ticket"
            />
          </div>
          <div className="md:col-span-2">
            <Button size="sm" disabled={saving} onClick={() => void saveStatus()}>
              Save status
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
