import {
  BORROWER_CONSENT_POLICY_VERSION,
  BORROWER_CONSENT_TEXT,
  type ApplicationConsentInput,
  type ApplicationConsentRecordDto,
} from '@lms/types';

export function buildApplicationConsentRecord(
  input: ApplicationConsentInput,
): ApplicationConsentRecordDto {
  if (input.policyVersion !== BORROWER_CONSENT_POLICY_VERSION) {
    throw new Error(
      `Unsupported consent policy version: ${input.policyVersion}. Expected ${BORROWER_CONSENT_POLICY_VERSION}.`,
    );
  }

  return {
    policyVersion: input.policyVersion,
    creditChecks: input.creditChecks,
    dataSharing: input.dataSharing,
    acceptedAt: new Date().toISOString(),
    creditChecksText: BORROWER_CONSENT_TEXT.creditChecks,
    dataSharingText: BORROWER_CONSENT_TEXT.dataSharing,
  };
}

export function parseApplicationConsentRecord(
  value: unknown,
): ApplicationConsentRecordDto | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const raw = value as Record<string, unknown>;
  if (
    typeof raw.policyVersion !== 'string' ||
    typeof raw.acceptedAt !== 'string' ||
    typeof raw.creditChecksText !== 'string' ||
    typeof raw.dataSharingText !== 'string' ||
    raw.creditChecks !== true ||
    raw.dataSharing !== true
  ) {
    return null;
  }

  return {
    policyVersion: raw.policyVersion,
    creditChecks: true,
    dataSharing: true,
    acceptedAt: raw.acceptedAt,
    creditChecksText: raw.creditChecksText,
    dataSharingText: raw.dataSharingText,
  };
}
