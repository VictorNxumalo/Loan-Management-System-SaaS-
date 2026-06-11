'use client';

import { useSession } from 'next-auth/react';
import { useCallback, useEffect, useState } from 'react';
import type { TeamListDto } from '@lms/types';
import { INVITABLE_ROLE_LABELS, UserRole } from '@lms/types';
import { RoleBadge } from '@/components/role-badge';
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
import { canManageSettings } from '@/lib/permissions';
import { useApi } from '@/lib/use-api';

export default function TeamPage() {
  const api = useApi();
  const { data: session } = useSession();
  const isAdmin = canManageSettings(session?.user?.role ?? undefined);

  const [team, setTeam] = useState<TeamListDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<string>(UserRole.LOAN_OFFICER);
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadTeam = useCallback(async () => {
    try {
      const result = await api<TeamListDto>('/team');
      setTeam(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load team');
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    if (session?.accessToken && isAdmin) {
      void loadTeam();
    }
  }, [session?.accessToken, isAdmin, loadTeam]);

  const sendInvite = async () => {
    setError(null);
    setMessage(null);
    setSending(true);
    try {
      const result = await api<{ message: string }>('/team/invite', {
        method: 'POST',
        body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
      });
      setMessage(result.message);
      setInviteEmail('');
      await loadTeam();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send invite');
    } finally {
      setSending(false);
    }
  };

  const revokeInvite = async (inviteId: string) => {
    setError(null);
    setMessage(null);
    try {
      const result = await api<{ message: string }>(`/team/invites/${inviteId}`, {
        method: 'DELETE',
      });
      setMessage(result.message);
      await loadTeam();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not revoke invite');
    }
  };

  const removeMember = async (memberId: string, name: string) => {
    if (!window.confirm(`Remove ${name}'s access to this workspace?`)) {
      return;
    }
    setError(null);
    setMessage(null);
    try {
      const result = await api<{ message: string }>(`/team/${memberId}`, {
        method: 'DELETE',
      });
      setMessage(result.message);
      await loadTeam();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not remove member');
    }
  };

  if (!isAdmin) {
    return (
      <p className="text-sm text-muted-foreground">
        Only admins can manage the team.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Team</h1>
        <p className="text-muted-foreground">
          Invite staff to {session?.organisation?.name} and manage their access.
        </p>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
      {message && <p className="text-sm text-green-700">{message}</p>}

      <Card>
        <CardHeader>
          <CardTitle>Invite a team member</CardTitle>
          <CardDescription>
            They will receive an email link to create their staff account. Loan
            officers can manage borrowers and loans; viewers have read-only access.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-64 flex-1 space-y-2">
              <Label htmlFor="inviteEmail">Email</Label>
              <Input
                id="inviteEmail"
                type="email"
                value={inviteEmail}
                onChange={(event) => setInviteEmail(event.target.value)}
                placeholder="colleague@example.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="inviteRole">Role</Label>
              <select
                id="inviteRole"
                className="flex h-9 w-44 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
                value={inviteRole}
                onChange={(event) => setInviteRole(event.target.value)}
              >
                {Object.entries(INVITABLE_ROLE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <Button
              onClick={() => void sendInvite()}
              disabled={!inviteEmail || sending}
            >
              {sending ? 'Sending…' : 'Send invite'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Members</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : (
            <div className="divide-y">
              {team?.members.map((member) => (
                <div
                  key={member.id}
                  className="flex flex-wrap items-center justify-between gap-3 py-3"
                >
                  <div>
                    <p className="text-sm font-medium">
                      {member.name}
                      {member.isSelf && (
                        <span className="ml-2 text-xs text-muted-foreground">(you)</span>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground">{member.email}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <RoleBadge role={member.role ?? undefined} />
                    {!member.isActive ? (
                      <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                        Deactivated
                      </span>
                    ) : (
                      !member.isSelf && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => void removeMember(member.id, member.name)}
                        >
                          Remove access
                        </Button>
                      )
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Pending invites</CardTitle>
        </CardHeader>
        <CardContent>
          {team?.pendingInvites.length ? (
            <div className="divide-y">
              {team.pendingInvites.map((invite) => (
                <div
                  key={invite.id}
                  className="flex flex-wrap items-center justify-between gap-3 py-3"
                >
                  <div>
                    <p className="text-sm font-medium">{invite.email}</p>
                    <p className="text-xs text-muted-foreground">
                      Invited by {invite.invitedByName} · expires{' '}
                      {new Date(invite.expiresAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <RoleBadge role={invite.role} />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => void revokeInvite(invite.id)}
                    >
                      Revoke
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No pending invites.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
