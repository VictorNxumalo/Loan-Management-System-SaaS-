import { z } from 'zod';
import { interestTypeSchema, loanStatusSchema, paginationQuerySchema, repaymentFrequencySchema } from './schemas';

export const generateScheduleInputSchema = z.object({
  principalCents: z.number().int().positive(),
  annualRate: z.number().nonnegative(),
  interestType: interestTypeSchema,
  termPeriods: z.number().int().min(1),
  frequency: repaymentFrequencySchema,
  startDate: z.coerce.date(),
});

export const previewScheduleInputSchema = generateScheduleInputSchema.extend({
  currencyCode: z.string().length(3).default('ZAR'),
  locale: z.string().default('en-ZA'),
});

export const createLoanSchema = generateScheduleInputSchema.extend({
  borrowerId: z.string().uuid(),
});

export const updateLoanSchema = createLoanSchema.partial();

export const listLoansQuerySchema = paginationQuerySchema.extend({
  status: loanStatusSchema.optional(),
  borrowerId: z.string().uuid().optional(),
  page: z.coerce.number().int().min(1).default(1),
});

export type GenerateScheduleInputDto = z.infer<typeof generateScheduleInputSchema>;
export type PreviewScheduleInputDto = z.infer<typeof previewScheduleInputSchema>;
export type CreateLoanInput = z.infer<typeof createLoanSchema>;
export type UpdateLoanInput = z.infer<typeof updateLoanSchema>;
export type ListLoansQuery = z.infer<typeof listLoansQuerySchema>;

export interface SchedulePreviewPeriodDto {
  periodNumber: number;
  dueDate: string;
  principalDue: string;
  interestDue: string;
  totalDue: string;
  balanceAfter: string;
}

export interface SchedulePreviewSummaryDto {
  totalPrincipal: string;
  totalInterest: string;
  totalRepayable: string;
  numberOfPeriods: number;
}

export interface SchedulePreviewResultDto {
  periods: SchedulePreviewPeriodDto[];
  summary: SchedulePreviewSummaryDto;
}

export interface RepaymentScheduleDbRowDto {
  periodNumber: number;
  dueDate: Date;
  principalDueCents: number;
  interestDueCents: number;
  totalDueCents: number;
  balanceAfterCents: number;
}

export interface LoanSchedulePeriodDto {
  periodNumber: number;
  dueDate: string;
  principalDueFormatted: string;
  interestDueFormatted: string;
  totalDueFormatted: string;
  balanceAfterFormatted: string;
}

export interface LoanListItemDto {
  id: string;
  borrowerId: string;
  borrowerName: string;
  principalFormatted: string;
  status: string;
  startDate: string;
  outstandingBalanceFormatted: string;
  createdAt: string;
}

export interface LoanDetailDto {
  id: string;
  borrowerId: string;
  borrowerName: string;
  principalCents: number;
  principalFormatted: string;
  annualRate: number;
  interestType: string;
  termPeriods: number;
  frequency: string;
  startDate: string;
  status: string;
  disbursementStatus: string;
  disbursedAt: string | null;
  totalScheduledFormatted: string;
  totalPaidFormatted: string;
  outstandingBalanceFormatted: string;
  schedule: LoanSchedulePeriodDto[];
  createdAt: string;
  updatedAt: string;
}

export interface PaginatedLoansDto {
  items: LoanListItemDto[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}
