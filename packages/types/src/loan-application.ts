import { z } from 'zod';
import { LoanApplicationStatus } from './enums';
import {
  interestTypeSchema,
  paginationQuerySchema,
  repaymentFrequencySchema,
} from './schemas';

export const loanApplicationStatusSchema = z.enum([
  LoanApplicationStatus.SUBMITTED,
  LoanApplicationStatus.APPROVED,
  LoanApplicationStatus.REJECTED,
  LoanApplicationStatus.WITHDRAWN,
]);

export const submitLoanApplicationSchema = z.object({
  orgId: z.string().uuid(),
  principalCents: z.number().int().positive(),
  interestType: interestTypeSchema,
  termPeriods: z.number().int().min(1).max(360),
  frequency: repaymentFrequencySchema,
  startDate: z.coerce.date(),
  purpose: z.string().min(1).max(1000).optional(),
});

export const rejectLoanApplicationSchema = z.object({
  lenderNotes: z.string().min(1).max(2000),
});

export const approveLoanApplicationSchema = z.object({
  annualRate: z.number().nonnegative(),
  lenderNotes: z.string().max(2000).optional(),
});

export const listLoanApplicationsQuerySchema = paginationQuerySchema.extend({
  status: loanApplicationStatusSchema.optional(),
  page: z.coerce.number().int().min(1).default(1),
});

export type SubmitLoanApplicationInput = z.infer<typeof submitLoanApplicationSchema>;
export type RejectLoanApplicationInput = z.infer<typeof rejectLoanApplicationSchema>;
export type ApproveLoanApplicationInput = z.infer<typeof approveLoanApplicationSchema>;
export type ListLoanApplicationsQuery = z.infer<typeof listLoanApplicationsQuerySchema>;

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

export interface LoanApplicationDetailDto extends LoanApplicationListItemDto {
  lenderNotes: string | null;
  borrowerId: string | null;
  updatedAt: string;
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
