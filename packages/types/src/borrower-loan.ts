import { z } from 'zod';
import { LoanStatus } from './enums';
import type { LoanSchedulePeriodDto } from './loan';
import type { BorrowerPendingPaymentDto } from './payment-submission';
import type { RecordRepaymentResultDto } from './repayment';
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
  outstandingBalanceCents: number;
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
  /** Pay instantly from the LMS wallet (primary repayment path) */
  canPayFromWallet: boolean;
  /** Report a bank payment made outside the app (fallback) */
  canReportExternalPayment: boolean;
  /** @deprecated Use canReportExternalPayment */
  canSubmitPayment: boolean;
  agreement: import('./loan-agreement').LoanAgreementSummaryDto;
  createdAt: string;
  updatedAt: string;
}

export const payFromWalletSchema = z.object({
  amountCents: z.number().int().positive(),
  paymentDate: z.coerce.date().optional(),
  note: z.string().max(500).optional(),
});

export type PayFromWalletInput = z.infer<typeof payFromWalletSchema>;

export interface PayFromWalletResultDto extends RecordRepaymentResultDto {
  walletAvailableBalanceFormatted: string;
}

export interface PaginatedBorrowerLoansDto {
  items: BorrowerLoanListItemDto[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}
