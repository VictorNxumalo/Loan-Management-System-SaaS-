import { z } from 'zod';
import { bankDetailsSchema } from './loan-application';
import { paginationQuerySchema } from './schemas';

export const WalletOwnerType = {
  ORGANISATION: 'ORGANISATION',
  BORROWER_USER: 'BORROWER_USER',
} as const;

export type WalletOwnerType =
  (typeof WalletOwnerType)[keyof typeof WalletOwnerType];

export const WalletTransactionType = {
  TOP_UP: 'TOP_UP',
  WITHDRAWAL: 'WITHDRAWAL',
  DISBURSEMENT: 'DISBURSEMENT',
  REPAYMENT: 'REPAYMENT',
  ADJUSTMENT: 'ADJUSTMENT',
  REVERSAL: 'REVERSAL',
} as const;

export type WalletTransactionType =
  (typeof WalletTransactionType)[keyof typeof WalletTransactionType];

export const WalletTransactionStatus = {
  PENDING: 'PENDING',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
  CANCELLED: 'CANCELLED',
} as const;

export type WalletTransactionStatus =
  (typeof WalletTransactionStatus)[keyof typeof WalletTransactionStatus];

export const DisbursementStatus = {
  NOT_STARTED: 'NOT_STARTED',
  PENDING: 'PENDING',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
} as const;

export type DisbursementStatus =
  (typeof DisbursementStatus)[keyof typeof DisbursementStatus];

export const walletBankAccountSchema = bankDetailsSchema;

export const walletTopUpSchema = z.object({
  amountCents: z.number().int().positive(),
  description: z.string().trim().max(500).optional(),
});

export const walletWithdrawSchema = walletTopUpSchema;

export const listWalletTransactionsQuerySchema = paginationQuerySchema.extend({
  page: z.coerce.number().int().min(1).default(1),
});

export type WalletBankAccountInput = z.infer<typeof walletBankAccountSchema>;
export type WalletTopUpInput = z.infer<typeof walletTopUpSchema>;
export type WalletWithdrawInput = z.infer<typeof walletWithdrawSchema>;
export type ListWalletTransactionsQuery = z.infer<
  typeof listWalletTransactionsQuerySchema
>;

export interface WalletBankAccountDto {
  accountHolder: string;
  bankName: string;
  branchCode: string;
  accountNumberMasked: string;
  verifiedAt: string | null;
}

export interface WalletSummaryDto {
  id: string;
  availableBalanceCents: number;
  availableBalanceFormatted: string;
  currency: string;
  walletConfigured: boolean;
  walletBankLinked: boolean;
  bankAccount: WalletBankAccountDto | null;
}

export interface WalletTransactionDto {
  id: string;
  type: string;
  status: string;
  amountCents: number;
  amountFormatted: string;
  balanceAfterFormatted: string | null;
  loanId: string | null;
  description: string | null;
  createdAt: string;
}

export interface PaginatedWalletTransactionsDto {
  items: WalletTransactionDto[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}
