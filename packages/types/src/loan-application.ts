import { z } from 'zod';
import type { ApplicationConsentRecordDto } from './compliance';
import { applicationConsentSchema } from './compliance';
import { LoanApplicationStatus } from './enums';
import {
  interestTypeSchema,
  paginationQuerySchema,
  repaymentFrequencySchema,
} from './schemas';

export const bankDetailsSchema = z.object({
  accountHolder: z.string().trim().min(2).max(120),
  bankName: z.string().trim().min(2).max(120),
  branchCode: z
    .string()
    .trim()
    .regex(/^\d{6}$/, 'Branch code must be exactly 6 digits'),
  accountNumber: z
    .string()
    .trim()
    .regex(/^\d{6,20}$/, 'Account number must be 6–20 digits'),
});

export const loanApplicationStatusSchema = z.enum([
  LoanApplicationStatus.DRAFT,
  LoanApplicationStatus.SUBMITTED,
  LoanApplicationStatus.APPROVED,
  LoanApplicationStatus.REJECTED,
  LoanApplicationStatus.WITHDRAWN,
]);

export const createLoanApplicationDraftSchema = z.object({
  orgId: z.string().uuid(),
  principalCents: z.number().int().positive(),
  interestType: interestTypeSchema,
  termPeriods: z.number().int().min(1).max(360),
  frequency: repaymentFrequencySchema,
  startDate: z.coerce.date(),
  purpose: z.string().min(1).max(1000).optional(),
  /** Omitted when applying — copied from the borrower's linked profile wallet bank account */
  bankDetails: bankDetailsSchema.optional(),
  consent: applicationConsentSchema,
});

/** @deprecated Use createLoanApplicationDraftSchema — kept as alias for imports */
export const submitLoanApplicationSchema = createLoanApplicationDraftSchema;

export const requestApplicationDocumentUploadSchema = z.object({
  documentType: z.enum(['ID_COPY']),
  filename: z.string().min(1).max(255),
  contentType: z.string().min(1).max(128),
  sizeBytes: z.number().int().positive().max(10_485_760),
});

export const rejectLoanApplicationSchema = z.object({
  lenderNotes: z.string().min(1).max(2000),
});

export const APPLICATION_REVIEW_CHECKLIST_ITEMS = [
  {
    id: 'idVerified',
    label: 'SA ID verified',
    description:
      'Profile ID document was attached to the application and appears authentic.',
  },
  {
    id: 'bankDetailsVerified',
    label: 'Bank details verified',
    description: 'Account holder, bank, branch code, and account number are complete and consistent.',
  },
  {
    id: 'affordabilityReviewed',
    label: 'Affordability reviewed',
    description: 'Repayment capacity and requested terms were assessed.',
  },
  {
    id: 'purposePlausible',
    label: 'Purpose plausible',
    description: 'The stated loan purpose is reasonable for the amount requested.',
  },
] as const;

export type ApplicationReviewChecklistItemId =
  (typeof APPLICATION_REVIEW_CHECKLIST_ITEMS)[number]['id'];

export const applicationReviewChecklistSchema = z.object({
  idVerified: z.boolean(),
  bankDetailsVerified: z.boolean(),
  affordabilityReviewed: z.boolean(),
  purposePlausible: z.boolean(),
});

export function isApplicationReviewChecklistComplete(
  checklist: ApplicationReviewChecklist | null | undefined,
): boolean {
  if (!checklist) {
    return false;
  }

  return APPLICATION_REVIEW_CHECKLIST_ITEMS.every((item) => checklist[item.id] === true);
}

export type ApplicationReviewChecklist = z.infer<typeof applicationReviewChecklistSchema>;

export const approveLoanApplicationSchema = z.object({
  annualRate: z.number().nonnegative(),
  lenderNotes: z.string().max(2000).optional(),
});

export const listLoanApplicationsQuerySchema = paginationQuerySchema.extend({
  status: loanApplicationStatusSchema.optional(),
  page: z.coerce.number().int().min(1).default(1),
});

export type CreateLoanApplicationDraftInput = z.infer<
  typeof createLoanApplicationDraftSchema
>;
export type SubmitLoanApplicationInput = CreateLoanApplicationDraftInput;
export type RequestApplicationDocumentUploadInput = z.infer<
  typeof requestApplicationDocumentUploadSchema
>;
export type RejectLoanApplicationInput = z.infer<typeof rejectLoanApplicationSchema>;
export type ApproveLoanApplicationInput = z.infer<typeof approveLoanApplicationSchema>;
export type ListLoanApplicationsQuery = z.infer<typeof listLoanApplicationsQuerySchema>;

export interface ApplicationBankDetailsDto {
  accountHolder: string;
  bankName: string;
  branchCode: string;
  accountNumber: string;
}

export interface ApplicationDocumentRequirementDto {
  documentType: string;
  label: string;
  min: number;
  max: number;
  uploaded: number;
  met: boolean;
}

export interface ApplicationDocumentsSummaryDto {
  requirements: ApplicationDocumentRequirementDto[];
  isComplete: boolean;
}

export interface LoanApplicationListItemDto {
  id: string;
  orgId: string;
  organisationName: string;
  borrowerUserId: string;
  borrowerName: string;
  principalFormatted: string;
  status: string;
  purpose: string | null;
  startDate: string;
  termPeriods: number;
  frequency: string;
  interestType: string;
  loanId: string | null;
  submittedAt: string;
  reviewedAt: string | null;
}

export interface ApplicationReviewChecklistStatusDto {
  items: {
    id: ApplicationReviewChecklistItemId;
    label: string;
    description: string;
    checked: boolean;
  }[];
  isComplete: boolean;
}

export interface LoanApplicationDetailDto extends LoanApplicationListItemDto {
  lenderNotes: string | null;
  borrowerId: string | null;
  updatedAt: string;
  bankDetails: ApplicationBankDetailsDto | null;
  documents: ApplicationDocumentsSummaryDto;
  reviewChecklist: ApplicationReviewChecklistStatusDto;
  consentRecord: ApplicationConsentRecordDto | null;
}

export interface PaginatedLoanApplicationsDto {
  items: LoanApplicationListItemDto[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface ApproveLoanApplicationResultDto {
  application: LoanApplicationDetailDto;
  loanId: string;
  borrowerId: string;
}
