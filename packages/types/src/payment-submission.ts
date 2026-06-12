import { z } from 'zod';

export const PaymentProvider = {
  MANUAL: 'MANUAL',
  STRIPE: 'STRIPE',
} as const;

export type PaymentProvider = (typeof PaymentProvider)[keyof typeof PaymentProvider];

export const PaymentSubmissionStatus = {
  AWAITING_PROOF: 'AWAITING_PROOF',
  PENDING: 'PENDING',
  CONFIRMED: 'CONFIRMED',
  REJECTED: 'REJECTED',
} as const;

export type PaymentSubmissionStatus =
  (typeof PaymentSubmissionStatus)[keyof typeof PaymentSubmissionStatus];

export const createPaymentSubmissionSchema = z.object({
  amountCents: z.number().int().positive(),
  paymentDate: z.coerce.date(),
  referenceNote: z.string().max(500).optional(),
});

export const requestPaymentProofUploadSchema = z.object({
  filename: z.string().min(1).max(255),
  contentType: z.string().min(1).max(128),
  sizeBytes: z.number().int().positive().max(10_485_760),
});

export const rejectPaymentSubmissionSchema = z.object({
  reviewNote: z.string().min(1).max(1000),
});

export type CreatePaymentSubmissionInput = z.infer<typeof createPaymentSubmissionSchema>;
export type RequestPaymentProofUploadInput = z.infer<typeof requestPaymentProofUploadSchema>;
export type RejectPaymentSubmissionInput = z.infer<typeof rejectPaymentSubmissionSchema>;

export interface PaymentSubmissionListItemDto {
  id: string;
  loanId: string;
  amountFormatted: string;
  paymentDate: string;
  status: string;
  referenceNote: string | null;
  submittedAt: string | null;
  createdAt: string;
}

export interface PaymentSubmissionDetailDto extends PaymentSubmissionListItemDto {
  orgId: string;
  borrowerName: string;
  organisationName: string;
  loanPrincipalFormatted: string;
  loanOutstandingFormatted: string;
  provider: string;
  externalReference: string | null;
  reviewNote: string | null;
  reviewedAt: string | null;
  repaymentId: string | null;
  hasProofDocument: boolean;
}

export interface ConfirmPaymentSubmissionResultDto {
  submission: PaymentSubmissionDetailDto;
  repaymentId: string;
}

export interface BorrowerPendingPaymentDto {
  id: string;
  amountFormatted: string;
  paymentDate: string;
  status: string;
  statusLabel: string;
  referenceNote: string | null;
  submittedAt: string | null;
  reviewNote: string | null;
}

export const PAYMENT_SUBMISSION_STATUS_LABELS: Record<string, string> = {
  AWAITING_PROOF: 'Awaiting proof',
  PENDING: 'Pending lender confirmation',
  CONFIRMED: 'Confirmed',
  REJECTED: 'Rejected',
};

export const PaymentProofDocumentType = {
  PROOF_OF_PAYMENT: 'PROOF_OF_PAYMENT',
} as const;

export type PaymentProofDocumentType =
  (typeof PaymentProofDocumentType)[keyof typeof PaymentProofDocumentType];
