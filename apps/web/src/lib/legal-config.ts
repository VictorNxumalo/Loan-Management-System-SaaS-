/** Public legal copy — override via env for production branding. */
export const LEGAL_LAST_UPDATED = '12 June 2026';

export function getLegalOperatorName(): string {
  return process.env.NEXT_PUBLIC_LEGAL_OPERATOR_NAME?.trim() || 'LMS (Loan Management System)';
}

export function getLegalContactEmail(): string {
  return process.env.NEXT_PUBLIC_LEGAL_CONTACT_EMAIL?.trim() || 'legal@example.com';
}

export const PRODUCT_NAME = 'LMS';
export const PRODUCT_FULL_NAME = 'Loan Management System';
