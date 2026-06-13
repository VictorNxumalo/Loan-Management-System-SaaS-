import { z } from 'zod';

export const LoanAgreementStatus = {
  NOT_SENT: 'NOT_SENT',
  PENDING_SIGNATURE: 'PENDING_SIGNATURE',
  SIGNED: 'SIGNED',
} as const;

export type LoanAgreementStatus =
  (typeof LoanAgreementStatus)[keyof typeof LoanAgreementStatus];

export const signLoanAgreementSchema = z.object({
  acknowledged: z.literal(true, {
    errorMap: () => ({ message: 'You must acknowledge the agreement to sign' }),
  }),
});

export type SignLoanAgreementInput = z.infer<typeof signLoanAgreementSchema>;

export interface LoanAgreementSignatureDto {
  signerName: string;
  signerEmail: string;
  idNumber: string;
  organisationName: string;
  signedAt: string;
  acknowledgment: string;
}

export interface LoanAgreementSummaryDto {
  status: LoanAgreementStatus;
  sentAt: string | null;
  signedAt: string | null;
  signerName: string | null;
  canSend: boolean;
  canDisburse: boolean;
  requiresBorrowerSignature: boolean;
  canSign: boolean;
}

export interface SendLoanAgreementResultDto {
  loanId: string;
  agreement: LoanAgreementSummaryDto;
}

export interface SignLoanAgreementResultDto {
  loanId: string;
  agreement: LoanAgreementSummaryDto;
}
