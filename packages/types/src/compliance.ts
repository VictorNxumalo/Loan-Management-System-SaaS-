import { z } from 'zod';
import { LenderVerificationStatus } from './marketplace';

/** Bump when consent copy changes — stored on each application for POPIA evidence. */
export const BORROWER_CONSENT_POLICY_VERSION = '2026-06-16';

export const BORROWER_CONSENT_TEXT = {
  creditChecks:
    'I consent to this lender running affordability and credit-related checks for this loan application.',
  dataSharing:
    'I consent to LMS sharing my application and profile details with this lender for credit assessment and compliance review.',
} as const;

export const applicationConsentSchema = z.object({
  creditChecks: z.literal(true),
  dataSharing: z.literal(true),
  policyVersion: z.string().min(1).max(32),
});

export type ApplicationConsentInput = z.infer<typeof applicationConsentSchema>;

export interface ApplicationConsentRecordDto {
  policyVersion: string;
  creditChecks: boolean;
  dataSharing: boolean;
  acceptedAt: string;
  creditChecksText: string;
  dataSharingText: string;
}

export const platformVerificationReviewSchema = z.object({
  verificationStatus: z.enum([
    LenderVerificationStatus.UNVERIFIED,
    LenderVerificationStatus.VERIFIED,
    LenderVerificationStatus.REGISTERED,
  ]),
  verificationNotes: z.string().max(1000).optional(),
});

export type PlatformVerificationReviewInput = z.infer<
  typeof platformVerificationReviewSchema
>;

export interface PlatformLenderComplianceDto {
  orgId: string;
  organisationName: string;
  isPublic: boolean;
  legalEntityName: string | null;
  ncrRegistrationNumber: string | null;
  complianceContactEmail: string | null;
  verificationStatus: string;
  verificationLabel: string;
  verificationReviewedAt: string | null;
  verificationReviewedByEmail: string | null;
  verificationNotes: string | null;
}
