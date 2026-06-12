import { z } from 'zod';

export const LenderMarketplaceCategory = {
  MICRO_LENDER: 'MICRO_LENDER',
  PERSONAL_LOANS: 'PERSONAL_LOANS',
  BUSINESS_LOANS: 'BUSINESS_LOANS',
  PAYDAY_LOANS: 'PAYDAY_LOANS',
  COMMUNITY_CREDIT: 'COMMUNITY_CREDIT',
  OTHER: 'OTHER',
} as const;

export type LenderMarketplaceCategory =
  (typeof LenderMarketplaceCategory)[keyof typeof LenderMarketplaceCategory];

export const LenderVerificationStatus = {
  UNVERIFIED: 'UNVERIFIED',
  VERIFIED: 'VERIFIED',
  REGISTERED: 'REGISTERED',
} as const;

export type LenderVerificationStatus =
  (typeof LenderVerificationStatus)[keyof typeof LenderVerificationStatus];

export const LENDER_MARKETPLACE_CATEGORY_LABELS: Record<LenderMarketplaceCategory, string> = {
  MICRO_LENDER: 'Micro lender',
  PERSONAL_LOANS: 'Personal loans',
  BUSINESS_LOANS: 'Business loans',
  PAYDAY_LOANS: 'Short-term / payday',
  COMMUNITY_CREDIT: 'Community credit',
  OTHER: 'Other',
};

export const LENDER_VERIFICATION_STATUS_LABELS: Record<LenderVerificationStatus, string> = {
  UNVERIFIED: 'Unverified',
  VERIFIED: 'Verified',
  REGISTERED: 'Registered lender',
};

export const marketplaceProfileSchema = z.object({
  category: z
    .enum([
      LenderMarketplaceCategory.MICRO_LENDER,
      LenderMarketplaceCategory.PERSONAL_LOANS,
      LenderMarketplaceCategory.BUSINESS_LOANS,
      LenderMarketplaceCategory.PAYDAY_LOANS,
      LenderMarketplaceCategory.COMMUNITY_CREDIT,
      LenderMarketplaceCategory.OTHER,
    ])
    .optional(),
  description: z.string().max(500).optional(),
  typicalLoanMinCents: z.number().int().nonnegative().optional(),
  typicalLoanMaxCents: z.number().int().positive().optional(),
  verificationStatus: z
    .enum([
      LenderVerificationStatus.UNVERIFIED,
      LenderVerificationStatus.VERIFIED,
      LenderVerificationStatus.REGISTERED,
    ])
    .optional(),
});

export type MarketplaceProfileInput = z.infer<typeof marketplaceProfileSchema>;

export interface MarketplaceProfileDto {
  category: LenderMarketplaceCategory;
  categoryLabel: string;
  description: string | null;
  typicalLoanMinCents: number | null;
  typicalLoanMaxCents: number | null;
  typicalLoanRangeFormatted: string | null;
  verificationStatus: LenderVerificationStatus;
  verificationLabel: string;
}

export interface MarketplaceLenderDto {
  id: string;
  name: string;
  isPublic: boolean;
  isConnected: boolean;
  /** Internal SaaS billing tier — not shown to borrowers in the UI */
  plan: string;
  profile: MarketplaceProfileDto;
}

export interface BorrowerLendingStatusDto {
  hasActiveCommitment: boolean;
  committedOrgId: string | null;
  committedOrgName: string | null;
  canConnectToOtherLenders: boolean;
  canApplyWithOtherLenders: boolean;
  message: string | null;
}

export const listMarketplaceLendersQuerySchema = z.object({
  category: z
    .enum([
      LenderMarketplaceCategory.MICRO_LENDER,
      LenderMarketplaceCategory.PERSONAL_LOANS,
      LenderMarketplaceCategory.BUSINESS_LOANS,
      LenderMarketplaceCategory.PAYDAY_LOANS,
      LenderMarketplaceCategory.COMMUNITY_CREDIT,
      LenderMarketplaceCategory.OTHER,
    ])
    .optional(),
});

export type ListMarketplaceLendersQuery = z.infer<typeof listMarketplaceLendersQuerySchema>;
