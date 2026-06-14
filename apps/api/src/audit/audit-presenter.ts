import type { AuditLogDetailFieldDto } from '@lms/types';

const ACTION_LABELS: Record<string, string> = {
  'borrower.created': 'Borrower profile created',
  'borrower.updated': 'Borrower profile updated',
  'borrower.deleted': 'Borrower profile removed',
  'loan.created': 'Loan created',
  'loan.updated': 'Loan updated',
  'loan.activated': 'Loan activated',
  'loan.disbursed': 'Loan disbursed',
  'loan.agreement.sent': 'Loan agreement sent to borrower',
  'loan.agreement.signed': 'Loan agreement signed',
  'repayment.recorded': 'Repayment recorded',
  'payment_submission.confirmed': 'Bank payment confirmed',
  'payment_submission.rejected': 'Bank payment rejected',
  'document.uploaded': 'Document uploaded',
  'document.deleted': 'Document removed',
  'application.approved': 'Application approved',
  'application.rejected': 'Application rejected',
  'settings.updated': 'Workspace settings updated',
  'team.invite_sent': 'Team invite sent',
  'team.invite_revoked': 'Team invite revoked',
  'team.member_removed': 'Team member removed',
  'team.member_joined': 'Team member joined',
};

function formatCentsValue(value: unknown): string | null {
  if (typeof value !== 'number' || !Number.isInteger(value)) {
    return null;
  }
  return new Intl.NumberFormat('en-ZA', {
    style: 'currency',
    currency: 'ZAR',
  }).format(value / 100);
}

function readString(state: Record<string, unknown>, key: string): string | null {
  const value = state[key];
  return typeof value === 'string' && value.trim() ? value : null;
}

function readFormattedMoney(state: Record<string, unknown>, key: string): string | null {
  const centsKey = key.endsWith('Cents') ? key : `${key}Cents`;
  const formatted = formatCentsValue(state[centsKey]);
  if (formatted) {
    return formatted;
  }
  const raw = state[key];
  return typeof raw === 'string' ? raw : null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function buildDetails(
  action: string,
  before: Record<string, unknown> | null,
  after: Record<string, unknown> | null,
): AuditLogDetailFieldDto[] {
  const details: AuditLogDetailFieldDto[] = [];
  const source = after ?? before;

  if (!source) {
    return details;
  }

  const push = (label: string, value: string | null | undefined) => {
    if (value) {
      details.push({ label, value });
    }
  };

  push('Borrower', readString(source, 'borrowerName'));
  push('Borrower user', readString(source, 'borrowerUserId'));
  push('Loan', readString(source, 'loanId'));
  push('Application', readString(source, 'applicationId'));
  push('Agreement', readString(source, 'agreementId'));
  push('Amount', readFormattedMoney(source, 'amount'));
  push('Principal', readFormattedMoney(source, 'principal'));
  push('Payment date', readString(source, 'paymentDate'));
  push('Loan status after', readString(source, 'loanStatusAfter'));
  push('Disbursement status', readString(source, 'disbursementStatus'));
  push('Review note', readString(source, 'reviewNote'));
  push('Lender notes', readString(source, 'lenderNotes'));
  push('Document type', readString(source, 'documentType'));
  push('Filename', readString(source, 'filename'));
  push('Signed at', readString(source, 'signedAt'));

  if (action === 'application.approved' || action === 'application.rejected') {
    push('Annual rate', readString(source, 'annualRate'));
  }

  return details;
}

function buildSubjectLabel(
  action: string,
  after: Record<string, unknown> | null,
  before: Record<string, unknown> | null,
): string | null {
  const source = after ?? before;
  if (!source) {
    return null;
  }

  if (readString(source, 'borrowerName')) {
    return readString(source, 'borrowerName');
  }

  if (action.startsWith('loan.') || action === 'repayment.recorded') {
    const loanId = readString(source, 'loanId');
    if (loanId) {
      return `Loan ${loanId.slice(0, 8).toUpperCase()}`;
    }
  }

  if (action.startsWith('application.')) {
    const applicationId = readString(source, 'applicationId');
    if (applicationId) {
      return `Application ${applicationId.slice(0, 8).toUpperCase()}`;
    }
  }

  return null;
}

function buildSummary(
  action: string,
  subjectLabel: string | null,
  after: Record<string, unknown> | null,
): string {
  const label = ACTION_LABELS[action] ?? action.replaceAll('.', ' ');
  const amount = after ? readFormattedMoney(after, 'amount') : null;

  if (subjectLabel && amount) {
    return `${label} for ${subjectLabel} (${amount})`;
  }

  if (subjectLabel) {
    return `${label} for ${subjectLabel}`;
  }

  if (amount) {
    return `${label} (${amount})`;
  }

  return label;
}

export function presentAuditLogEntry(entry: {
  action: string;
  entityType: string;
  entityId: string;
  beforeState: unknown;
  afterState: unknown;
}) {
  const before = asRecord(entry.beforeState);
  const after = asRecord(entry.afterState);
  const subjectLabel = buildSubjectLabel(entry.action, after, before);
  const details = buildDetails(entry.action, before, after);

  details.push(
    { label: 'Entity type', value: entry.entityType },
    { label: 'Entity ID', value: entry.entityId },
  );

  return {
    summary: buildSummary(entry.action, subjectLabel, after),
    subjectLabel,
    details,
  };
}

export function getAuditActionLabel(action: string): string {
  return ACTION_LABELS[action] ?? action.replaceAll('.', ' ');
}
