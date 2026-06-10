'use client';

import { useSession } from 'next-auth/react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

export default function DashboardPage() {
  const { data: session } = useSession();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Welcome back, {session?.user?.name}. KPIs and widgets arrive in Phase 4.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Portfolio</CardTitle>
            <CardDescription>Active loans and balances</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold text-muted-foreground">—</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Repayments</CardTitle>
            <CardDescription>Collected this month</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold text-muted-foreground">—</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Arrears</CardTitle>
            <CardDescription>Loans past due</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold text-muted-foreground">—</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
