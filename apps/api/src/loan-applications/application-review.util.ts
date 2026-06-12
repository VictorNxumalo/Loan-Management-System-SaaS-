import type {
  ApplicationReviewChecklist,
  ApplicationReviewChecklistStatusDto,
} from '@lms/types';
import {
  APPLICATION_REVIEW_CHECKLIST_ITEMS,
  applicationReviewChecklistSchema,
  isApplicationReviewChecklistComplete,
} from '@lms/types';

export function parseApplicationReviewChecklist(
  value: unknown,
): ApplicationReviewChecklist | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const parsed = applicationReviewChecklistSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

export function buildApplicationReviewChecklistStatus(
  checklist: ApplicationReviewChecklist | null,
): ApplicationReviewChecklistStatusDto {
  return {
    items: APPLICATION_REVIEW_CHECKLIST_ITEMS.map((item) => ({
      id: item.id,
      label: item.label,
      description: item.description,
      checked: checklist?.[item.id] === true,
    })),
    isComplete: isApplicationReviewChecklistComplete(checklist),
  };
}

export function assertApplicationReviewChecklistComplete(
  checklist: ApplicationReviewChecklist | null,
): void {
  if (!isApplicationReviewChecklistComplete(checklist)) {
    throw new Error(
      'Complete the application review checklist before approving or rejecting',
    );
  }
}
