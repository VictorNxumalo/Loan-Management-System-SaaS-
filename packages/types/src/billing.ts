import { z } from 'zod';
import { OrganisationPlan } from './enums';

export const PLAN_LIMITS: Record<
  string,
  { maxActiveLoans: number | null; maxUsers: number | null; label: string }
> = {
  [OrganisationPlan.STARTER]: {
    maxActiveLoans: 50,
    maxUsers: 1,
    label: 'Starter',
  },
  [OrganisationPlan.PRO]: {
    maxActiveLoans: 500,
    maxUsers: 5,
    label: 'Pro',
  },
  [OrganisationPlan.BUSINESS]: {
    maxActiveLoans: null,
    maxUsers: 20,
    label: 'Business',
  },
};

export const createCheckoutSessionSchema = z.object({
  plan: z.enum([
    OrganisationPlan.STARTER,
    OrganisationPlan.PRO,
    OrganisationPlan.BUSINESS,
  ]),
});

export type CreateCheckoutSessionInput = z.infer<typeof createCheckoutSessionSchema>;

export interface BillingStatusDto {
  plan: string;
  planStatus: string;
  planLabel: string;
  trialEndsAt: string | null;
  trialDaysRemaining: number | null;
  isReadOnly: boolean;
  isStripeConfigured: boolean;
  currentPeriodEnd: string | null;
  subscriptionStatus: string | null;
  limits: {
    maxActiveLoans: number | null;
    maxUsers: number | null;
    activeLoans: number;
    users: number;
  };
}

export interface CheckoutSessionDto {
  url: string;
}

export interface BillingPortalDto {
  url: string;
}
