import { z } from 'zod';
import { interestTypeSchema } from './schemas';

export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  name: z.string().min(1, 'Name is required').max(120),
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

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type GoogleAuthInput = z.infer<typeof googleAuthSchema>;
export type OnboardingInput = z.infer<typeof onboardingSchema>;

export interface AuthUserResponse {
  id: string;
  email: string;
  name: string;
  role: string;
  emailVerified: boolean;
  onboardingCompleted: boolean;
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
  organisation: AuthOrganisationResponse;
}

export interface AuthTokensResponse {
  accessToken: string;
  expiresIn: number;
  user: AuthUserResponse;
  organisation: AuthOrganisationResponse;
}
