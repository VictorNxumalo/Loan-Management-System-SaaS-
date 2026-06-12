import { z } from 'zod';
import { LoanStatus } from './enums';
import type { LoanSchedulePeriodDto } from './loan';
import type { BorrowerPendingPaymentDto } from './payment-submission';
import { paginationQuerySchema } from './schemas';

export const BORROWER_VISIBLE_LOAN_STATUSES = [
  LoanStatus.DRAFT,
  LoanStatus.ACTIVE,
  LoanStatus.IN_ARREARS,
  LoanStatus.COMPLETED,
  LoanStatus.WRITTEN_OFF,
] as const;

export const BORROWER_LOAN_STATUS_LABELS: Record<string, string> = {
  [LoanStatus.DRAFT]: 'Pending activation',
  [LoanStatus.ACTIVE]: 'Active',
  [LoanStatus.IN_ARREARS]: 'In arrears',
  [LoanStatus.COMPLETED]: 'Completed',
  [LoanStatus.WRITTEN_OFF]: 'Written off',
};

export const listBorrowerLoansQuerySchema = paginationQuerySchema.extend({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type ListBorrowerLoansQuery = z.infer<typeof listBorrowerLoansQuerySchema>;

export interface BorrowerLoanListItemDto {
  id: string;
  orgId: string;
  organisationName: string;
  principalFormatted: string;
  status: string;
  statusLabel: string;
  startDate: string;
  outstandingBalanceFormatted: string;
  createdAt: string;
}

export interface BorrowerLoanRepaymentDto {
  id: string;
  amountFormatted: string;
  paymentDate: string;
  note: string | null;
  createdAt: string;
}

export interface BorrowerLoanDetailDto {
  id: string;
  orgId: string;
  organisationName: string;
  principalCents: number;
  principalFormatted: string;
  annualRate: number;
  interestType: string;
  termPeriods: number;
  frequency: string;
  startDate: string;
  status: string;
  statusLabel: string;
  totalScheduledFormatted: string;
  totalPaidFormatted: string;
  outstandingBalanceFormatted: string;
  daysOverdue: number | null;
  schedule: LoanSchedulePeriodDto[];
  repayments: BorrowerLoanRepaymentDto[];
  pendingPayments: BorrowerPendingPaymentDto[];
  canSubmitPayment: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PaginatedBorrowerLoansDto {
  items: BorrowerLoanListItemDto[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}
