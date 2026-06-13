import { BadRequestException } from '@nestjs/common';

/** Map profile bank names / labels to Stitch DisbursementBankBeneficiaryBankId values. */
const BANK_ALIASES: Record<string, string> = {
  absa: 'absa',
  'absa bank': 'absa',
  capitec: 'capitec',
  'capitec bank': 'capitec',
  fnb: 'fnb',
  'first national bank': 'fnb',
  'fnb bank': 'fnb',
  nedbank: 'nedbank',
  standard: 'standard_bank',
  'standard bank': 'standard_bank',
  investec: 'investec',
  discovery: 'discovery_bank',
  'discovery bank': 'discovery_bank',
  tyme: 'tymebank',
  tymebank: 'tymebank',
  african: 'african_bank',
  'african bank': 'african_bank',
  bidvest: 'za_bidvest',
  'bidvest bank': 'za_bidvest',
};

export function resolveStitchBankId(bankName: string): string {
  const key = bankName.trim().toLowerCase();
  const id = BANK_ALIASES[key];
  if (!id) {
    throw new BadRequestException(
      `Bank "${bankName}" is not supported for Stitch disbursements. Use a major SA bank (FNB, ABSA, Standard Bank, Nedbank, Capitec, etc.).`,
    );
  }
  return id;
}

/** Stitch beneficiary name max 20 chars. */
export function formatStitchBeneficiaryName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) {
    throw new BadRequestException('Beneficiary name is required for disbursement');
  }
  return trimmed.length > 20 ? trimmed.slice(0, 20) : trimmed;
}

/** Convert cents to Stitch amount.quantity string (ZAR). */
export function centsToStitchQuantity(amountCents: number): string {
  if (!Number.isInteger(amountCents) || amountCents <= 0) {
    throw new BadRequestException('Disbursement amount must be a positive integer (cents)');
  }
  if (amountCents % 100 === 0) {
    return String(amountCents / 100);
  }
  return (amountCents / 100).toFixed(2);
}

export function maskAccountNumber(accountNumber: string): string {
  const digits = accountNumber.replace(/\s/g, '');
  if (digits.length <= 4) return '****';
  return `****${digits.slice(-4)}`;
}
