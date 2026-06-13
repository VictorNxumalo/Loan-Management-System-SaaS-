import { fromCents, toCents, toDecimal } from '@lms/utils';

/** Parse user-entered Rand amount (e.g. "10 000.50" or "R1500") to integer cents. */
export function parseRandInputToCents(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }

  const cleaned = trimmed
    .replace(/^R\s*/i, '')
    .replace(/\u00A0/g, '')
    .replace(/\s/g, '')
    .replace(/,/g, '.');

  if (!/^\d+(\.\d{0,2})?$/.test(cleaned)) {
    return null;
  }

  try {
    return toCents(toDecimal(cleaned));
  } catch {
    return null;
  }
}

/** Format cents for a money input field (decimal Rand, no symbol). */
export function formatCentsForInput(cents: number | null | undefined): string {
  if (cents == null || cents < 0) {
    return '';
  }
  return fromCents(cents).toFixed(2);
}

/** Display formatted ZAR for hints under inputs. */
export function formatRandDisplay(cents: number | null | undefined): string | null {
  if (cents == null || cents <= 0) {
    return null;
  }
  return new Intl.NumberFormat('en-ZA', {
    style: 'currency',
    currency: 'ZAR',
  }).format(cents / 100);
}
