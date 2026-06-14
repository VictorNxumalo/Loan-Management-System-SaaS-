export function formatLoanReference(loanId: string, createdAt: Date): string {
  const year = createdAt.getFullYear();
  const suffix = loanId.replace(/-/g, '').slice(0, 4).toUpperCase();
  return `LN-${year}-${suffix}`;
}
