import { describe, expect, it } from 'vitest';
import {
  DEFAULT_NCR_REPO_RATE_PERCENT,
  getNcaMaxAnnualRatePercent,
  isAnnualRateWithinNcaCap,
} from './nca-rates';

describe('nca-rates', () => {
  it('computes the NCA unsecured credit cap from repo rate', () => {
    expect(getNcaMaxAnnualRatePercent(8.25)).toBe(38.15);
    expect(getNcaMaxAnnualRatePercent(DEFAULT_NCR_REPO_RATE_PERCENT)).toBe(38.15);
  });

  it('accepts rates at or below the cap', () => {
    expect(isAnnualRateWithinNcaCap(12)).toBe(true);
    expect(isAnnualRateWithinNcaCap(38.15)).toBe(true);
  });

  it('rejects rates above the cap', () => {
    expect(isAnnualRateWithinNcaCap(38.16)).toBe(false);
    expect(isAnnualRateWithinNcaCap(48)).toBe(false);
  });
});
