/** Stitch disbursement status — mirrors DB enum and webhook lifecycle. */
export const StitchDisbursementStatus = {
  PENDING: 'PENDING',
  SUBMITTED: 'SUBMITTED',
  COMPLETED: 'COMPLETED',
  ERROR: 'ERROR',
  PAUSED: 'PAUSED',
  CANCELLED: 'CANCELLED',
  REVERSED: 'REVERSED',
} as const;

export type StitchDisbursementStatus =
  (typeof StitchDisbursementStatus)[keyof typeof StitchDisbursementStatus];

export interface LoanStitchDisbursementDto {
  id: string;
  status: StitchDisbursementStatus;
  statusReason: string | null;
  stitchDisbursementId: string | null;
  amountFormatted: string;
  beneficiaryName: string;
  beneficiaryBankId: string;
  beneficiaryAccountNumberMasked: string;
  disbursementType: string;
  createdAt: string;
  updatedAt: string;
  lastWebhookAt: string | null;
}
