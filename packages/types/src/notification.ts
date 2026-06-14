import { z } from 'zod';
import { paginationQuerySchema } from './schemas';

export const NotificationType = {
  APPLICATION_SUBMITTED: 'APPLICATION_SUBMITTED',
  APPLICATION_APPROVED: 'APPLICATION_APPROVED',
  APPLICATION_REJECTED: 'APPLICATION_REJECTED',
  LOAN_ACTIVATED: 'LOAN_ACTIVATED',
  LOAN_DISBURSED: 'LOAN_DISBURSED',
  LOAN_AGREEMENT_SENT: 'LOAN_AGREEMENT_SENT',
  LOAN_AGREEMENT_SIGNED: 'LOAN_AGREEMENT_SIGNED',
  REPAYMENT_REMINDER: 'REPAYMENT_REMINDER',
  LOAN_OVERDUE: 'LOAN_OVERDUE',
  PAYMENT_SUBMITTED: 'PAYMENT_SUBMITTED',
  PAYMENT_CONFIRMED: 'PAYMENT_CONFIRMED',
  PAYMENT_REJECTED: 'PAYMENT_REJECTED',
  WALLET_REPAYMENT_RECEIVED: 'WALLET_REPAYMENT_RECEIVED',
} as const;

export type NotificationType =
  (typeof NotificationType)[keyof typeof NotificationType];

export const listNotificationsQuerySchema = paginationQuerySchema.extend({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export type ListNotificationsQuery = z.infer<typeof listNotificationsQuerySchema>;

export interface NotificationDto {
  id: string;
  orgId: string;
  type: string;
  title: string;
  body: string;
  readAt: string | null;
  relatedEntityType: string | null;
  relatedEntityId: string | null;
  createdAt: string;
}

export interface PaginatedNotificationsDto {
  items: NotificationDto[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  unreadCount: number;
}

export interface UnreadNotificationCountDto {
  unreadCount: number;
}

export interface ApplicationSubmittedJobData {
  eventType: typeof NotificationType.APPLICATION_SUBMITTED;
  dedupKey: string;
  orgId: string;
  applicationId: string;
  borrowerName: string;
  principalFormatted: string;
}

export interface ApplicationDecisionJobData {
  eventType:
    | typeof NotificationType.APPLICATION_APPROVED
    | typeof NotificationType.APPLICATION_REJECTED;
  dedupKey: string;
  orgId: string;
  applicationId: string;
  borrowerUserId: string;
  organisationName: string;
  principalFormatted: string;
  lenderNotes?: string | null;
}

export interface RepaymentReminderJobData {
  eventType: typeof NotificationType.REPAYMENT_REMINDER;
  dedupKey: string;
  orgId: string;
  loanId: string;
  borrowerUserId: string;
  organisationName: string;
  dueDate: string;
  amountFormatted: string;
  periodNumber: number;
}

export interface LoanOverdueJobData {
  eventType: typeof NotificationType.LOAN_OVERDUE;
  dedupKey: string;
  orgId: string;
  loanId: string;
  borrowerName: string;
  daysOverdue: number;
  outstandingFormatted: string;
}

export interface PaymentSubmittedJobData {
  eventType: typeof NotificationType.PAYMENT_SUBMITTED;
  dedupKey: string;
  orgId: string;
  paymentSubmissionId: string;
  loanId: string;
  borrowerName: string;
  amountFormatted: string;
  paymentDate: string;
}

export interface PaymentDecisionJobData {
  eventType:
    | typeof NotificationType.PAYMENT_CONFIRMED
    | typeof NotificationType.PAYMENT_REJECTED;
  dedupKey: string;
  orgId: string;
  paymentSubmissionId: string;
  loanId: string;
  borrowerUserId: string;
  organisationName: string;
  amountFormatted: string;
  paymentDate: string;
  reviewNote?: string | null;
}

export interface LoanActivatedJobData {
  eventType: typeof NotificationType.LOAN_ACTIVATED;
  dedupKey: string;
  orgId: string;
  loanId: string;
  borrowerUserId: string;
  organisationName: string;
  principalFormatted: string;
}

export interface LoanDisbursedJobData {
  eventType: typeof NotificationType.LOAN_DISBURSED;
  dedupKey: string;
  orgId: string;
  loanId: string;
  borrowerUserId: string;
  borrowerName: string;
  organisationName: string;
  amountFormatted: string;
}

export interface LoanAgreementSentJobData {
  eventType: typeof NotificationType.LOAN_AGREEMENT_SENT;
  dedupKey: string;
  orgId: string;
  loanId: string;
  borrowerUserId: string;
  organisationName: string;
  principalFormatted: string;
}

export interface LoanAgreementSignedJobData {
  eventType: typeof NotificationType.LOAN_AGREEMENT_SIGNED;
  dedupKey: string;
  orgId: string;
  loanId: string;
  borrowerName: string;
  borrowerUserId: string;
  organisationName: string;
  principalFormatted: string;
}

export interface WalletRepaymentReceivedJobData {
  eventType: typeof NotificationType.WALLET_REPAYMENT_RECEIVED;
  dedupKey: string;
  orgId: string;
  loanId: string;
  repaymentId: string;
  borrowerName: string;
  amountFormatted: string;
  paymentDate: string;
}

export type NotificationJobData =
  | ApplicationSubmittedJobData
  | ApplicationDecisionJobData
  | RepaymentReminderJobData
  | LoanOverdueJobData
  | PaymentSubmittedJobData
  | PaymentDecisionJobData
  | LoanActivatedJobData
  | LoanDisbursedJobData
  | LoanAgreementSentJobData
  | LoanAgreementSignedJobData
  | WalletRepaymentReceivedJobData;
