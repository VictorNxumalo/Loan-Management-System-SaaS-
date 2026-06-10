'use client';

import type { SchedulePreviewResultDto } from '@lms/types';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

export function SchedulePreview({ preview }: { preview: SchedulePreviewResultDto }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Repayment schedule preview</CardTitle>
        <CardDescription>
          {preview.summary.numberOfPeriods} periods · Total repayable{' '}
          {preview.summary.totalRepayable}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <SummaryItem label="Principal" value={preview.summary.totalPrincipal} />
          <SummaryItem label="Interest" value={preview.summary.totalInterest} />
          <SummaryItem label="Total repayable" value={preview.summary.totalRepayable} />
        </div>
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-muted/50 text-left">
              <tr>
                <th className="px-3 py-2">#</th>
                <th className="px-3 py-2">Due date</th>
                <th className="px-3 py-2">Principal</th>
                <th className="px-3 py-2">Interest</th>
                <th className="px-3 py-2">Total</th>
                <th className="px-3 py-2">Balance after</th>
              </tr>
            </thead>
            <tbody>
              {preview.periods.map((period) => (
                <tr key={period.periodNumber} className="border-t">
                  <td className="px-3 py-2">{period.periodNumber}</td>
                  <td className="px-3 py-2">{period.dueDate}</td>
                  <td className="px-3 py-2">{period.principalDue}</td>
                  <td className="px-3 py-2">{period.interestDue}</td>
                  <td className="px-3 py-2">{period.totalDue}</td>
                  <td className="px-3 py-2">{period.balanceAfter}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-lg font-semibold">{value}</p>
    </div>
  );
}
