/** Mask bank account number — show last 4 digits only. */
export function maskAccountNumber(accountNumber: string): string {
  const trimmed = accountNumber.trim();
  if (trimmed.length <= 4) {
    return '****';
  }
  return `****${trimmed.slice(-4)}`;
}
