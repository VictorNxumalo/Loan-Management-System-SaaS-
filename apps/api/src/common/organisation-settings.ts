import type {
  LenderMarketplaceCategory,
  LenderVerificationStatus,
  MarketplaceProfileDto,
  MarketplaceProfileInput,
} from '@lms/types';
import {
  LENDER_MARKETPLACE_CATEGORY_LABELS,
  LENDER_VERIFICATION_STATUS_LABELS,
  LenderMarketplaceCategory as Category,
  LenderVerificationStatus as Verification,
} from '@lms/types';
import { formatCents } from './money';

export function isPublicListingEnabled(settings: unknown): boolean {
  if (!settings || typeof settings !== 'object') {
    return false;
  }

  const value = (settings as Record<string, unknown>).publicListing;
  return value === true || value === 'true';
}

export function defaultLenderOrganisationSettings(
  existing: Record<string, unknown> = {},
): Record<string, unknown> {
  const existingProfile =
    existing.marketplaceProfile && typeof existing.marketplaceProfile === 'object'
      ? (existing.marketplaceProfile as Record<string, unknown>)
      : {};

  return {
    ...existing,
    publicListing: existing.publicListing ?? true,
    marketplaceProfile: {
      category: existingProfile.category ?? Category.OTHER,
      description: existingProfile.description ?? '',
      verificationStatus: existingProfile.verificationStatus ?? Verification.UNVERIFIED,
      ...(existingProfile.typicalLoanMinCents !== undefined
        ? { typicalLoanMinCents: existingProfile.typicalLoanMinCents }
        : {}),
      ...(existingProfile.typicalLoanMaxCents !== undefined
        ? { typicalLoanMaxCents: existingProfile.typicalLoanMaxCents }
        : {}),
    },
  };
}

export function parseMarketplaceProfile(settings: unknown): MarketplaceProfileDto {
  const root =
    settings && typeof settings === 'object'
      ? (settings as Record<string, unknown>)
      : {};
  const raw =
    root.marketplaceProfile && typeof root.marketplaceProfile === 'object'
      ? (root.marketplaceProfile as Record<string, unknown>)
      : {};

  const category = isMarketplaceCategory(raw.category)
    ? raw.category
    : Category.OTHER;
  const verificationStatus = isVerificationStatus(raw.verificationStatus)
    ? raw.verificationStatus
    : Verification.UNVERIFIED;

  const typicalLoanMinCents =
    typeof raw.typicalLoanMinCents === 'number' ? raw.typicalLoanMinCents : null;
  const typicalLoanMaxCents =
    typeof raw.typicalLoanMaxCents === 'number' ? raw.typicalLoanMaxCents : null;

  return {
    category,
    categoryLabel: LENDER_MARKETPLACE_CATEGORY_LABELS[category],
    description:
      typeof raw.description === 'string' && raw.description.trim()
        ? raw.description.trim()
        : null,
    typicalLoanMinCents,
    typicalLoanMaxCents,
    typicalLoanRangeFormatted: formatTypicalLoanRange(
      typicalLoanMinCents,
      typicalLoanMaxCents,
    ),
    verificationStatus,
    verificationLabel: LENDER_VERIFICATION_STATUS_LABELS[verificationStatus],
    verificationReviewedAt:
      typeof raw.verificationReviewedAt === 'string' && raw.verificationReviewedAt.trim()
        ? raw.verificationReviewedAt.trim()
        : null,
  };
}

export interface LenderComplianceProfileDto {
  legalEntityName: string | null;
  ncrRegistrationNumber: string | null;
  complianceContactEmail: string | null;
  verificationReviewedByEmail: string | null;
  verificationNotes: string | null;
}

export function parseLenderComplianceProfile(settings: unknown): LenderComplianceProfileDto {
  const root =
    settings && typeof settings === 'object'
      ? (settings as Record<string, unknown>)
      : {};
  const compliance =
    root.lenderComplianceProfile && typeof root.lenderComplianceProfile === 'object'
      ? (root.lenderComplianceProfile as Record<string, unknown>)
      : {};
  const marketplace =
    root.marketplaceProfile && typeof root.marketplaceProfile === 'object'
      ? (root.marketplaceProfile as Record<string, unknown>)
      : {};

  return {
    legalEntityName:
      typeof compliance.legalEntityName === 'string' && compliance.legalEntityName.trim()
        ? compliance.legalEntityName.trim()
        : null,
    ncrRegistrationNumber:
      typeof compliance.ncrRegistrationNumber === 'string' &&
      compliance.ncrRegistrationNumber.trim()
        ? compliance.ncrRegistrationNumber.trim()
        : null,
    complianceContactEmail:
      typeof compliance.complianceContactEmail === 'string' &&
      compliance.complianceContactEmail.trim()
        ? compliance.complianceContactEmail.trim()
        : null,
    verificationReviewedByEmail:
      typeof marketplace.verificationReviewedByEmail === 'string' &&
      marketplace.verificationReviewedByEmail.trim()
        ? marketplace.verificationReviewedByEmail.trim()
        : null,
    verificationNotes:
      typeof marketplace.verificationNotes === 'string' && marketplace.verificationNotes.trim()
        ? marketplace.verificationNotes.trim()
        : null,
  };
}

export function mergeMarketplaceProfile(
  current: Record<string, unknown>,
  input: MarketplaceProfileInput,
): Record<string, unknown> {
  const existing =
    current.marketplaceProfile && typeof current.marketplaceProfile === 'object'
      ? (current.marketplaceProfile as Record<string, unknown>)
      : {};

  const nextProfile: Record<string, unknown> = { ...existing };

  if (input.category !== undefined) {
    nextProfile.category = input.category;
  }
  if (input.description !== undefined) {
    nextProfile.description = input.description;
  }
  // verificationStatus is platform-managed only — never merged from lender settings
  if (input.typicalLoanMinCents !== undefined) {
    nextProfile.typicalLoanMinCents = input.typicalLoanMinCents;
  }
  if (input.typicalLoanMaxCents !== undefined) {
    nextProfile.typicalLoanMaxCents = input.typicalLoanMaxCents;
  }

  return {
    ...current,
    marketplaceProfile: nextProfile,
  };
}

function formatTypicalLoanRange(minCents: number | null, maxCents: number | null): string | null {
  if (minCents != null && maxCents != null) {
    return `${formatCents(minCents)} – ${formatCents(maxCents)}`;
  }
  if (minCents != null) {
    return `From ${formatCents(minCents)}`;
  }
  if (maxCents != null) {
    return `Up to ${formatCents(maxCents)}`;
  }
  return null;
}

function isMarketplaceCategory(value: unknown): value is LenderMarketplaceCategory {
  return typeof value === 'string' && value in LENDER_MARKETPLACE_CATEGORY_LABELS;
}

function isVerificationStatus(value: unknown): value is LenderVerificationStatus {
  return typeof value === 'string' && value in LENDER_VERIFICATION_STATUS_LABELS;
}
