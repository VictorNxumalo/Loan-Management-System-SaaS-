import { z } from 'zod';
import { UserRole } from './enums';

/** Roles an admin can assign when inviting staff (never ADMIN via invite). */
export const INVITABLE_ROLES = [UserRole.LOAN_OFFICER, UserRole.VIEWER] as const;

export const INVITABLE_ROLE_LABELS: Record<string, string> = {
  [UserRole.LOAN_OFFICER]: 'Loan Officer',
  [UserRole.VIEWER]: 'Read-only Viewer',
};

export const sendTeamInviteSchema = z.object({
  email: z.string().email(),
  role: z.enum([UserRole.LOAN_OFFICER, UserRole.VIEWER]),
});

export type SendTeamInviteInput = z.infer<typeof sendTeamInviteSchema>;

export interface TeamMemberDto {
  id: string;
  name: string;
  email: string;
  role: string | null;
  isActive: boolean;
  isSelf: boolean;
  joinedAt: string;
}

export interface TeamInviteDto {
  id: string;
  email: string;
  role: string;
  invitedByName: string;
  expiresAt: string;
  createdAt: string;
}

export interface TeamListDto {
  members: TeamMemberDto[];
  pendingInvites: TeamInviteDto[];
}

export const listAuditLogsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  entityType: z.string().min(1).max(64).optional(),
});

export type ListAuditLogsQuery = z.infer<typeof listAuditLogsQuerySchema>;

export interface AuditLogEntryDto {
  id: string;
  userName: string;
  userEmail: string;
  action: string;
  entityType: string;
  entityId: string;
  beforeState: unknown;
  afterState: unknown;
  createdAt: string;
  summary: string;
  subjectLabel: string | null;
  details: AuditLogDetailFieldDto[];
}

export interface AuditLogDetailFieldDto {
  label: string;
  value: string;
}

export interface PaginatedAuditLogsDto {
  items: AuditLogEntryDto[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}
