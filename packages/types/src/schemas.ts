import { z } from 'zod';
import {
  InterestType,
  LoanStatus,
  OrganisationPlan,
  RepaymentFrequency,
  UserRole,
} from './enums';

export const userRoleSchema = z.enum([
  UserRole.ADMIN,
  UserRole.LOAN_OFFICER,
  UserRole.VIEWER,
]);

export const interestTypeSchema = z.enum([
  InterestType.FLAT,
  InterestType.REDUCING,
]);

export const loanStatusSchema = z.enum([
  LoanStatus.DRAFT,
  LoanStatus.ACTIVE,
  LoanStatus.IN_ARREARS,
  LoanStatus.COMPLETED,
  LoanStatus.WRITTEN_OFF,
]);

export const repaymentFrequencySchema = z.enum([
  RepaymentFrequency.WEEKLY,
  RepaymentFrequency.BI_WEEKLY,
  RepaymentFrequency.MONTHLY,
]);

export const organisationPlanSchema = z.enum([
  OrganisationPlan.STARTER,
  OrganisationPlan.PRO,
  OrganisationPlan.BUSINESS,
]);

export const moneyCentsSchema = z.number().int().nonnegative();

export const paginationQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type PaginationQuery = z.infer<typeof paginationQuerySchema>;
