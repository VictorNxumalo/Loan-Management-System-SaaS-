'use client';

import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function BorrowerHomePage() {
  const { data: session } = useSession();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Borrower home</h1>
        <p className="text-muted-foreground">
          Welcome, {session?.user?.name}. Find lenders and manage your connections.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Browse lenders</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Discover lending organisations that have listed themselves publicly on LMS.
            </p>
            <Button asChild>
              <Link href="/borrower/lenders/browse">Browse directory</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>My lenders</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Lenders you connected with directly or accepted via invite.
            </p>
            <Button variant="outline" asChild>
              <Link href="/borrower/lenders/mine">View my lenders</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>My applications</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Submit and track loan requests to lenders you are connected with.
            </p>
            <Button variant="outline" asChild>
              <Link href="/borrower/applications">View applications</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
