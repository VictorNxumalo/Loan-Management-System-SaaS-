import { describe, expect, it } from 'vitest';
import { parseMarketplaceProfile } from '../common/organisation-settings';
import { LenderMarketplaceCategory, LenderVerificationStatus } from '@lms/types';

describe('parseMarketplaceProfile', () => {
  it('returns defaults when profile is missing', () => {
    const profile = parseMarketplaceProfile({ publicListing: true });

    expect(profile.category).toBe(LenderMarketplaceCategory.OTHER);
    expect(profile.verificationStatus).toBe(LenderVerificationStatus.UNVERIFIED);
    expect(profile.description).toBeNull();
  });

  it('maps stored profile fields', () => {
    const profile = parseMarketplaceProfile({
      marketplaceProfile: {
        category: LenderMarketplaceCategory.PERSONAL_LOANS,
        description: 'Personal loans up to R50k',
        verificationStatus: LenderVerificationStatus.REGISTERED,
        typicalLoanMinCents: 100000,
        typicalLoanMaxCents: 5000000,
      },
    });

    expect(profile.categoryLabel).toBe('Personal loans');
    expect(profile.description).toBe('Personal loans up to R50k');
    expect(profile.typicalLoanRangeFormatted).toContain('–');
  });
});
