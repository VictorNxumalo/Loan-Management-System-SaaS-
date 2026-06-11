import { z } from 'zod';
import { interestTypeSchema } from './schemas';

export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  name: z.string().min(1, 'Name is required').max(120),
  accountType: z.enum(['LENDER', 'BORROWER']),
  phone: z.string().min(7).max(20).optional(),
  /** Team invite token — joins an existing lender organisation with the invited role. */
  inviteToken: z.string().min(1).optional(),
});

export const borrowerOnboardingSchema = z.object({
  phone: z.string().min(7, 'Phone number is required').max(20),
  idNumber: z.string().min(4).max(30).optional(),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

export const googleAuthSchema = z.object({
  idToken: z.string().min(1),
});

export const onboardingSchema = z.object({
  organisationName: z.string().min(1).max(200),
  defaultCurrency: z.string().length(3),
  defaultInterestType: interestTypeSchema,
});

export const organisationSettingsSchema = z.object({
  publicListing: z.boolean().optional(),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type GoogleAuthInput = z.infer<typeof googleAuthSchema>;
export type OnboardingInput = z.infer<typeof onboardingSchema>;
export type BorrowerOnboardingInput = z.infer<typeof borrowerOnboardingSchema>;
export type OrganisationSettingsInput = z.infer<typeof organisationSettingsSchema>;

export interface AuthUserResponse {
  id: string;
  email: string;
  name: string;
  accountType: string;
  role: string | null;
  emailVerified: boolean;
  onboardingCompleted: boolean;
}

export interface BorrowerProfileResponse {
  phone: string;
  idNumber: string | null;
}

export interface MarketplaceLenderDto {
  id: string;
  name: string;
  plan: string;
  isPublic: boolean;
  isConnected: boolean;
}

export interface AuthOrganisationResponse {
  id: string;
  name: string;
  plan: string;
  planStatus: string;
  settings: Record<string, unknown>;
}

export interface AuthMeResponse {
  user: AuthUserResponse;
  organisation?: AuthOrganisationResponse;
  borrowerProfile?: BorrowerProfileResponse;
}

export interface AuthTokensResponse {
  accessToken: string;
  expiresIn: number;
  user: AuthUserResponse;
  organisation?: AuthOrganisationResponse;
  borrowerProfile?: BorrowerProfileResponse;
}
