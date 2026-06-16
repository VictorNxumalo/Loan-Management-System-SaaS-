import { z } from 'zod';

export const SupportTicketStatus = {
  OPEN: 'OPEN',
  IN_PROGRESS: 'IN_PROGRESS',
  WAITING_ON_USER: 'WAITING_ON_USER',
  RESOLVED: 'RESOLVED',
  CLOSED: 'CLOSED',
} as const;

export type SupportTicketStatus =
  (typeof SupportTicketStatus)[keyof typeof SupportTicketStatus];

export const SUPPORT_TICKET_STATUS_LABELS: Record<SupportTicketStatus, string> = {
  OPEN: 'Open',
  IN_PROGRESS: 'In progress',
  WAITING_ON_USER: 'Waiting on user',
  RESOLVED: 'Resolved',
  CLOSED: 'Closed',
};

export const SupportTicketCategory = {
  BILLING: 'BILLING',
  COMPLIANCE: 'COMPLIANCE',
  TECHNICAL: 'TECHNICAL',
  DISPUTE: 'DISPUTE',
  ACCOUNT: 'ACCOUNT',
  OTHER: 'OTHER',
} as const;

export type SupportTicketCategory =
  (typeof SupportTicketCategory)[keyof typeof SupportTicketCategory];

export const SUPPORT_TICKET_CATEGORY_LABELS: Record<SupportTicketCategory, string> = {
  BILLING: 'Billing & subscription',
  COMPLIANCE: 'Compliance & verification',
  TECHNICAL: 'Technical issue',
  DISPUTE: 'Dispute with another user',
  ACCOUNT: 'Account access',
  OTHER: 'Other',
};

export const SupportTicketReporterType = {
  LENDER: 'LENDER',
  BORROWER: 'BORROWER',
} as const;

export type SupportTicketReporterType =
  (typeof SupportTicketReporterType)[keyof typeof SupportTicketReporterType];

export const createSupportTicketSchema = z.object({
  category: z.enum([
    SupportTicketCategory.BILLING,
    SupportTicketCategory.COMPLIANCE,
    SupportTicketCategory.TECHNICAL,
    SupportTicketCategory.DISPUTE,
    SupportTicketCategory.ACCOUNT,
    SupportTicketCategory.OTHER,
  ]),
  subject: z.string().trim().min(3).max(200),
  description: z.string().trim().min(10).max(5000),
});

export type CreateSupportTicketInput = z.infer<typeof createSupportTicketSchema>;

export const addSupportTicketMessageSchema = z.object({
  body: z.string().trim().min(1).max(5000),
});

export type AddSupportTicketMessageInput = z.infer<typeof addSupportTicketMessageSchema>;

export const platformSupportTicketReviewSchema = z.object({
  status: z.enum([
    SupportTicketStatus.OPEN,
    SupportTicketStatus.IN_PROGRESS,
    SupportTicketStatus.WAITING_ON_USER,
    SupportTicketStatus.RESOLVED,
    SupportTicketStatus.CLOSED,
  ]),
  resolutionNote: z.string().trim().max(2000).optional(),
});

export type PlatformSupportTicketReviewInput = z.infer<
  typeof platformSupportTicketReviewSchema
>;

export const platformSupportTicketReplySchema = z.object({
  body: z.string().trim().min(1).max(5000),
  isInternal: z.boolean().optional(),
});

export type PlatformSupportTicketReplyInput = z.infer<
  typeof platformSupportTicketReplySchema
>;

export interface SupportTicketMessageDto {
  id: string;
  authorName: string;
  authorEmail: string;
  body: string;
  isInternal: boolean;
  createdAt: string;
}

export interface SupportTicketSummaryDto {
  id: string;
  ticketNumber: number;
  category: SupportTicketCategory;
  categoryLabel: string;
  subject: string;
  status: SupportTicketStatus;
  statusLabel: string;
  createdAt: string;
  updatedAt: string;
}

export interface SupportTicketDetailDto extends SupportTicketSummaryDto {
  description: string;
  reporterName: string;
  reporterEmail: string;
  reporterType: SupportTicketReporterType;
  organisationName: string | null;
  resolutionNote: string | null;
  resolvedAt: string | null;
  messages: SupportTicketMessageDto[];
}

export interface PlatformSupportOverviewDto {
  openTickets: number;
  inProgressTickets: number;
  waitingOnUserTickets: number;
  totalLenders: number;
  publicLenders: number;
}
