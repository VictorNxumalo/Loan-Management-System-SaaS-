import { describe, expect, it } from 'vitest';
import {
  centsToStitchQuantity,
  formatStitchBeneficiaryName,
  resolveStitchBankId,
} from './stitch-bank.util';

describe('stitch-bank.util', () => {
  it('resolves common SA bank names', () => {
    expect(resolveStitchBankId('FNB')).toBe('fnb');
    expect(resolveStitchBankId('Standard Bank')).toBe('standard_bank');
    expect(resolveStitchBankId('absa')).toBe('absa');
  });

  it('formats beneficiary name to max 20 chars', () => {
    expect(formatStitchBeneficiaryName('Jane Doe')).toBe('Jane Doe');
    expect(formatStitchBeneficiaryName('A Very Long Borrower Name Here').length).toBe(20);
  });

  it('converts cents to Stitch quantity', () => {
    expect(centsToStitchQuantity(500000)).toBe('5000');
    expect(centsToStitchQuantity(1050)).toBe('10.50');
  });
});
