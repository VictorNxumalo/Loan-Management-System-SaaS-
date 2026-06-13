import { z } from 'zod';
import { DocumentEntityType } from './enums';

export const BorrowerDocumentType = {
  ID_COPY: 'ID_COPY',
  PROOF_OF_INCOME: 'PROOF_OF_INCOME',
  PROOF_OF_ADDRESS: 'PROOF_OF_ADDRESS',
} as const;

export type BorrowerDocumentType =
  (typeof BorrowerDocumentType)[keyof typeof BorrowerDocumentType];

export const LoanDocumentType = {
  SIGNED_AGREEMENT: 'SIGNED_AGREEMENT',
  DISBURSEMENT_PROOF: 'DISBURSEMENT_PROOF',
} as const;

export type LoanDocumentType =
  (typeof LoanDocumentType)[keyof typeof LoanDocumentType];

export const BORROWER_DOCUMENT_TYPES = Object.values(BorrowerDocumentType);
export const LOAN_DOCUMENT_TYPES = Object.values(LoanDocumentType);

export const BORROWER_DOCUMENT_LABELS: Record<BorrowerDocumentType, string> = {
  ID_COPY: 'ID copy',
  PROOF_OF_INCOME: 'Proof of income',
  PROOF_OF_ADDRESS: 'Proof of address',
};

export const LOAN_DOCUMENT_LABELS: Record<LoanDocumentType, string> = {
  SIGNED_AGREEMENT: 'Signed loan agreement',
  DISBURSEMENT_PROOF: 'Disbursement proof',
};

export const ApplicationDocumentType = {
  ID_COPY: 'ID_COPY',
} as const;

export type ApplicationDocumentType =
  (typeof ApplicationDocumentType)[keyof typeof ApplicationDocumentType];

export const APPLICATION_DOCUMENT_TYPES = Object.values(ApplicationDocumentType);

export const APPLICATION_DOCUMENT_LABELS: Record<ApplicationDocumentType, string> = {
  ID_COPY: 'SA ID document (from profile)',
};

/** Linked automatically from the borrower's KYC profile — not uploaded per application. */
export const APPLICATION_DOCUMENT_REQUIREMENTS: Record<
  ApplicationDocumentType,
  { min: number; max: number; label: string }
> = {
  [ApplicationDocumentType.ID_COPY]: {
    min: 1,
    max: 1,
    label: APPLICATION_DOCUMENT_LABELS.ID_COPY,
  },
};

export const applicationDocumentTypeSchema = z.enum([ApplicationDocumentType.ID_COPY]);

export const documentEntityTypeSchema = z.enum([
  DocumentEntityType.BORROWER,
  DocumentEntityType.LOAN,
  DocumentEntityType.LOAN_APPLICATION,
  DocumentEntityType.PAYMENT_SUBMISSION,
]);

export const borrowerDocumentTypeSchema = z.enum([
  BorrowerDocumentType.ID_COPY,
  BorrowerDocumentType.PROOF_OF_INCOME,
  BorrowerDocumentType.PROOF_OF_ADDRESS,
]);

export const loanDocumentTypeSchema = z.enum([
  LoanDocumentType.SIGNED_AGREEMENT,
  LoanDocumentType.DISBURSEMENT_PROOF,
]);

export const listDocumentsQuerySchema = z.object({
  entityType: documentEntityTypeSchema,
  entityId: z.string().uuid(),
});

export const requestDocumentUploadSchema = z.object({
  entityType: documentEntityTypeSchema,
  entityId: z.string().uuid(),
  documentType: z.string().min(1).max(64),
  filename: z.string().min(1).max(255),
  contentType: z.string().min(1).max(128),
  sizeBytes: z.number().int().positive().max(10_485_760),
});

export type ListDocumentsQuery = z.infer<typeof listDocumentsQuerySchema>;
export type RequestDocumentUploadInput = z.infer<typeof requestDocumentUploadSchema>;

export interface DocumentDto {
  id: string;
  orgId: string;
  entityType: string;
  entityId: string;
  documentType: string;
  documentTypeLabel: string;
  originalFilename: string;
  uploadedByName: string;
  createdAt: string;
}

export interface DocumentUploadUrlDto {
  documentId: string;
  uploadUrl: string;
  token: string;
  storagePath: string;
  expiresInSeconds: number;
}

export interface DocumentDownloadUrlDto {
  downloadUrl: string;
  expiresInSeconds: number;
  originalFilename: string;
}
