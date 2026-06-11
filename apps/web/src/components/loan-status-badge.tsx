import { BORROWER_LOAN_STATUS_LABELS } from '@lms/types';

const statusStyles: Record<string, string> = {
  DRAFT: 'bg-slate-100 text-slate-800',
  ACTIVE: 'bg-green-100 text-green-900',
  IN_ARREARS: 'bg-red-100 text-red-900',
  COMPLETED: 'bg-blue-100 text-blue-900',
  WRITTEN_OFF: 'bg-muted text-muted-foreground',
};

export function LoanStatusBadge({ status }: { status: string }) {
  const label = BORROWER_LOAN_STATUS_LABELS[status] ?? status;

  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${statusStyles[status] ?? 'bg-muted text-muted-foreground'}`}
    >
      {label}
    </span>
  );
}
