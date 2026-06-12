import { describe, expect, it } from 'vitest';
import {
  buildApplicationReviewChecklistStatus,
  parseApplicationReviewChecklist,
} from './application-review.util';

describe('application-review.util', () => {
  it('parses valid checklist JSON', () => {
    const parsed = parseApplicationReviewChecklist({
      idVerified: true,
      bankDetailsVerified: true,
      statementsVerified: true,
      affordabilityReviewed: false,
      purposePlausible: false,
    });

    expect(parsed?.affordabilityReviewed).toBe(false);
  });

  it('marks checklist complete only when every item is true', () => {
    const incomplete = buildApplicationReviewChecklistStatus({
      idVerified: true,
      bankDetailsVerified: true,
      statementsVerified: true,
      affordabilityReviewed: true,
      purposePlausible: false,
    });
    expect(incomplete.isComplete).toBe(false);

    const complete = buildApplicationReviewChecklistStatus({
      idVerified: true,
      bankDetailsVerified: true,
      statementsVerified: true,
      affordabilityReviewed: true,
      purposePlausible: true,
    });
    expect(complete.isComplete).toBe(true);
  });
});
