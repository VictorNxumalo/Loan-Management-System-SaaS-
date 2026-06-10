'use client';

import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';
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

export default function SettingsPage() {
  const api = useApi();
  const { data: session, update } = useSession();
  const [publicListing, setPublicListing] = useState(true);
  const [inviteEmail, setInviteEmail] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const settings = session?.organisation?.settings ?? {};
    setPublicListing(settings.publicListing !== false);
  }, [session]);

  const saveListing = async () => {
    setError(null);
    setMessage(null);
    try {
      await api('/settings/organisation', {
        method: 'PATCH',
        body: JSON.stringify({ publicListing }),
      });
      await update();
      setMessage('Organisation settings saved.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save settings');
    }
  };

  const sendInvite = async () => {
    setError(null);
    setMessage(null);
    try {
      const result = await api<{ message: string }>('/settings/invites', {
        method: 'POST',
        body: JSON.stringify({ email: inviteEmail }),
      });
      setMessage(result.message);
      setInviteEmail('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send invite');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">
          Manage how borrowers can discover and connect with {session?.organisation?.name}.
        </p>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
      {message && <p className="text-sm text-green-700">{message}</p>}

      <Card>
        <CardHeader>
          <CardTitle>Public lender directory</CardTitle>
          <CardDescription>
            Listed by default so borrowers can find you. Turn off if you only work via
            private invites.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={publicListing}
              onChange={(event) => setPublicListing(event.target.checked)}
            />
            List our organisation publicly
          </label>
          <Button onClick={() => void saveListing()}>Save visibility</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Invite a borrower</CardTitle>
          <CardDescription>
            Send a private invite link to someone who wants to borrow from you.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="inviteEmail">Borrower email</Label>
            <Input
              id="inviteEmail"
              type="email"
              value={inviteEmail}
              onChange={(event) => setInviteEmail(event.target.value)}
            />
          </div>
          <Button onClick={() => void sendInvite()} disabled={!inviteEmail}>
            Send invite
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
