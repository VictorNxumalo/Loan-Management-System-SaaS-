const ROLE_LABELS: Record<string, string> = {
  ADMIN: 'Admin',
  LOAN_OFFICER: 'Loan officer',
  VIEWER: 'Viewer',
};

export function RoleBadge({ role }: { role?: string }) {
  if (!role) {
    return null;
  }

  const label = ROLE_LABELS[role] ?? role;

  return (
    <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
      {label}
    </span>
  );
}

export function AccountTypeBadge({ accountType }: { accountType?: string }) {
  if (accountType === 'BORROWER') {
    return (
      <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800">
        Borrower account
      </span>
    );
  }

  return (
    <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">
      Lending workspace
    </span>
  );
}
