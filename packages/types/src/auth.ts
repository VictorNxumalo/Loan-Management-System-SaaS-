import { z } from 'zod';
import { marketplaceProfileSchema } from './marketplace';
import { interestTypeSchema } from './schemas';

export {
  borrowerOnboardingSchema,
  lenderOnboardingSchema,
  saIdNumberSchema,
  kycProfileSchema,
} from './profile';
export type {
  BorrowerOnboardingInput,
  LenderOnboardingInput,
} from './profile';

export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  name: z.string().min(1, 'Name is required').max(120),
  accountType: z.enum(['LENDER', 'BORROWER']),
  phone: z.string().min(7).max(20).optional(),
  /** Team invite token — joins an existing lender organisation with the invited role. */
  inviteToken: z.string().min(1).optional(),
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

export const organisationLogoUploadSchema = z.object({
  filename: z.string().min(1).max(255),
  contentType: z.enum(['image/png', 'image/jpeg', 'image/webp']),
  sizeBytes: z.number().int().min(1).max(2 * 1024 * 1024),
});

/** @deprecated Use lenderOnboardingSchema — kept for legacy imports */
export const onboardingSchema = z.object({
  organisationName: z.string().min(1).max(200),
  defaultCurrency: z.string().length(3),
  defaultInterestType: interestTypeSchema,
  logoStoragePath: z.string().min(1).max(500).optional(),
});

export const organisationSettingsSchema = z.object({
  publicListing: z.boolean().optional(),
  marketplaceProfile: marketplaceProfileSchema.optional(),
  logoStoragePath: z.union([z.string().min(1).max(500), z.literal('')]).optional(),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type GoogleAuthInput = z.infer<typeof googleAuthSchema>;
export type OrganisationLogoUploadInput = z.infer<typeof organisationLogoUploadSchema>;
export type OnboardingInput = z.infer<typeof onboardingSchema>;
export type OrganisationSettingsInput = z.infer<typeof organisationSettingsSchema>;

export interface OrganisationLogoUploadUrlDto {
  uploadUrl: string;
  storagePath: string;
}

export interface AuthUserResponse {
  id: string;
  email: string;
  name: string;
  accountType: string;
  role: string | null;
  emailVerified: boolean;
  onboardingCompleted: boolean;
  profileComplete: boolean;
}

export interface BorrowerProfileResponse {
  phone: string;
  idNumber: string | null;
  address: string | null;
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
