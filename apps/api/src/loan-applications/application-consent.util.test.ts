import { describe, expect, it } from 'vitest';
import {
  BORROWER_CONSENT_POLICY_VERSION,
  BORROWER_CONSENT_TEXT,
} from '@lms/types';
import {
  buildApplicationConsentRecord,
  parseApplicationConsentRecord,
} from './application-consent.util';

describe('application consent', () => {
  it('builds a versioned consent record', () => {
    const record = buildApplicationConsentRecord({
      creditChecks: true,
      dataSharing: true,
      policyVersion: BORROWER_CONSENT_POLICY_VERSION,
    });

    expect(record.policyVersion).toBe(BORROWER_CONSENT_POLICY_VERSION);
    expect(record.creditChecksText).toBe(BORROWER_CONSENT_TEXT.creditChecks);
    expect(record.dataSharingText).toBe(BORROWER_CONSENT_TEXT.dataSharing);
    expect(record.acceptedAt).toMatch(/^\d{4}-/);
  });

  it('round-trips through parseApplicationConsentRecord', () => {
    const record = buildApplicationConsentRecord({
      creditChecks: true,
      dataSharing: true,
      policyVersion: BORROWER_CONSENT_POLICY_VERSION,
    });

    expect(parseApplicationConsentRecord(record)).toEqual(record);
  });
});
