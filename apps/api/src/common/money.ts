import { formatCurrency, fromCents } from '@lms/utils';

export function formatCents(cents: number, currencyCode = 'ZAR', locale = 'en-ZA'): string {
  return formatCurrency(fromCents(cents), currencyCode, locale);
}
