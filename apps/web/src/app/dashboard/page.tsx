'use client';

import type { DashboardDto } from '@lms/types';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';
import { ReportsExportPanel } from '@/components/reports-export-panel';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { useApi } from '@/lib/use-api';

export default function DashboardPage() {
  const { data: session } = useSession();
  const api = useApi();
  const [data, setData] = useState<DashboardDto | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void api<DashboardDto>('/dashboard')
      .then(setData)
      .catch((err: Error) => setError(err.message));
  }, [api]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Welcome back, {session?.user?.name}.
        </p>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {!data && !error && (
        <p className="text-muted-foreground">Loading dashboard…</p>
      )}

      {data && (
        <>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            <KpiCard
              title="Active loans"
              description="Active and in arrears"
              value={String(data.kpis.activeLoans)}
            />
            <KpiCard
              title="Portfolio value"
              description="Total outstanding balance"
              value={data.kpis.portfolioValueFormatted}
            />
            <KpiCard
              title="Repayments this month"
              description="Collected in current month"
              value={data.kpis.repaymentsThisMonthFormatted}
            />
            <KpiCard
              title="Loans in arrears"
              description="Past due"
              value={String(data.kpis.loansInArrears)}
            />
            <KpiCard
              title="Arrears rate"
              description="% of active loans"
              value={`${data.kpis.arrearsRatePercent}%`}
            />
          </div>

          <ReportsExportPanel />

          <Card>
            <CardHeader>
              <CardTitle>Upcoming repayments (7 days)</CardTitle>
              <CardDescription>Due within the next week</CardDescription>
            </CardHeader>
            <CardContent>
              <RepaymentTable
                items={data.upcoming7Days}
                emptyMessage="No repayments due in the next 7 days"
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Upcoming repayments (30 days)</CardTitle>
              <CardDescription>Due within the next month</CardDescription>
            </CardHeader>
            <CardContent>
              <RepaymentTable
                items={data.upcoming30Days}
                emptyMessage="No repayments due in the next 30 days"
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Overdue loans</CardTitle>
              <CardDescription>Sorted by days overdue</CardDescription>
            </CardHeader>
            <CardContent>
              <OverdueTable items={data.overdueLoans} />
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function KpiCard({
  title,
  description,
  value,
}: {
  title: string;
  description: string;
  value: string;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-semibold">{value}</p>
      </CardContent>
    </Card>
  );
}

function RepaymentTable({
  items,
  emptyMessage,
}: {
  items: DashboardDto['upcoming7Days'];
  emptyMessage: string;
}) {
  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyMessage}</p>;
  }

  return (
    <div className="overflow-x-auto rounded-md border">
      <table className="w-full min-w-[640px] text-sm">
        <thead className="bg-muted/50 text-left">
          <tr>
            <th className="px-3 py-2">Due date</th>
            <th className="px-3 py-2">Borrower</th>
            <th className="px-3 py-2">Period</th>
            <th className="px-3 py-2">Amount due</th>
            <th className="px-3 py-2">Status</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={`${item.loanId}-${item.periodNumber}`} className="border-t">
              <td className="px-3 py-2">{item.dueDate}</td>
              <td className="px-3 py-2">
                <Link
                  href={`/dashboard/borrowers/${item.borrowerId}`}
                  className="text-primary hover:underline"
                >
                  {item.borrowerName}
                </Link>
              </td>
              <td className="px-3 py-2">{item.periodNumber}</td>
              <td className="px-3 py-2">{item.amountDueFormatted}</td>
              <td className="px-3 py-2">{item.loanStatus}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function OverdueTable({ items }: { items: DashboardDto['overdueLoans'] }) {
  if (items.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No overdue loans</p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-md border">
      <table className="w-full min-w-[720px] text-sm">
        <thead className="bg-muted/50 text-left">
          <tr>
            <th className="px-3 py-2">Borrower</th>
            <th className="px-3 py-2">Outstanding</th>
            <th className="px-3 py-2">Days overdue</th>
            <th className="px-3 py-2">Oldest overdue due date</th>
            <th className="px-3 py-2">Status</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.loanId} className="border-t">
              <td className="px-3 py-2">
                <Link
                  href={`/dashboard/loans/${item.loanId}`}
                  className="font-medium text-primary hover:underline"
                >
                  {item.borrowerName}
                </Link>
              </td>
              <td className="px-3 py-2">{item.outstandingBalanceFormatted}</td>
              <td className="px-3 py-2">{item.daysOverdue}</td>
              <td className="px-3 py-2">{item.oldestOverdueDueDate}</td>
              <td className="px-3 py-2">{item.loanStatus}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
