const statusStyles: Record<string, string> = {
  SUBMITTED: 'bg-amber-100 text-amber-900',
  APPROVED: 'bg-green-100 text-green-900',
  REJECTED: 'bg-red-100 text-red-900',
  WITHDRAWN: 'bg-muted text-muted-foreground',
};

const statusLabels: Record<string, string> = {
  SUBMITTED: 'Pending review',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  WITHDRAWN: 'Withdrawn',
};

export function ApplicationStatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${statusStyles[status] ?? 'bg-muted text-muted-foreground'}`}
    >
      {statusLabels[status] ?? status}
    </span>
  );
}
