export const UserRole = {
  ADMIN: 'ADMIN',
  LOAN_OFFICER: 'LOAN_OFFICER',
  VIEWER: 'VIEWER',
} as const;

export type UserRole = (typeof UserRole)[keyof typeof UserRole];

export const InterestType = {
  FLAT: 'FLAT',
  REDUCING: 'REDUCING',
} as const;

export type InterestType = (typeof InterestType)[keyof typeof InterestType];

export const LoanStatus = {
  DRAFT: 'DRAFT',
  ACTIVE: 'ACTIVE',
  IN_ARREARS: 'IN_ARREARS',
  COMPLETED: 'COMPLETED',
  WRITTEN_OFF: 'WRITTEN_OFF',
} as const;

export type LoanStatus = (typeof LoanStatus)[keyof typeof LoanStatus];

export const RepaymentFrequency = {
  WEEKLY: 'WEEKLY',
  BI_WEEKLY: 'BI_WEEKLY',
  MONTHLY: 'MONTHLY',
} as const;

export type RepaymentFrequency =
  (typeof RepaymentFrequency)[keyof typeof RepaymentFrequency];

export const DocumentEntityType = {
  BORROWER: 'BORROWER',
  LOAN: 'LOAN',
} as const;

export type DocumentEntityType =
  (typeof DocumentEntityType)[keyof typeof DocumentEntityType];

export const OrganisationPlan = {
  STARTER: 'STARTER',
  PRO: 'PRO',
  BUSINESS: 'BUSINESS',
} as const;

export type OrganisationPlan =
  (typeof OrganisationPlan)[keyof typeof OrganisationPlan];

export const PlanStatus = {
  TRIAL: 'TRIAL',
  ACTIVE: 'ACTIVE',
  PAST_DUE: 'PAST_DUE',
  CANCELLED: 'CANCELLED',
  READ_ONLY: 'READ_ONLY',
} as const;

export type PlanStatus = (typeof PlanStatus)[keyof typeof PlanStatus];

export const SubscriptionStatus = {
  ACTIVE: 'ACTIVE',
  TRIALING: 'TRIALING',
  PAST_DUE: 'PAST_DUE',
  CANCELED: 'CANCELED',
  UNPAID: 'UNPAID',
} as const;

export type SubscriptionStatus =
  (typeof SubscriptionStatus)[keyof typeof SubscriptionStatus];
