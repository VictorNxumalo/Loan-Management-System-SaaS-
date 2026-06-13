'use client';

import type {
  ApplicationReviewChecklist,
  ApplicationReviewChecklistStatusDto,
  LoanApplicationDetailDto,
} from '@lms/types';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useApi } from '@/lib/use-api';

export function ApplicationReviewChecklistPanel({
  applicationId,
  checklist,
  canEdit,
  onSaved,
}: {
  applicationId: string;
  checklist: ApplicationReviewChecklistStatusDto;
  canEdit: boolean;
  onSaved: () => void;
}) {
  const api = useApi();
  const [answers, setAnswers] = useState<ApplicationReviewChecklist>(() =>
    toChecklistAnswers(checklist),
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setAnswers(toChecklistAnswers(checklist));
  }, [checklist]);

  const allConfirmed = Object.values(answers).every(Boolean);

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      await api<LoanApplicationDetailDto>(`/applications/${applicationId}/review-checklist`, {
        method: 'POST',
        body: JSON.stringify(answers),
      });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save checklist');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-lg border bg-background p-6 space-y-4">
      <div>
        <h2 className="font-semibold">Review checklist</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Confirm each item after reviewing the application pack. Approve and reject are
          blocked until every item is marked Yes.
        </p>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <ul className="space-y-4">
        {checklist.items.map((item) => (
          <li key={item.id} className="rounded-md border p-4">
            <p className="font-medium">{item.label}</p>
            <p className="mt-1 text-sm text-muted-foreground">{item.description}</p>
            <div className="mt-3 flex flex-wrap gap-4 text-sm">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name={item.id}
                  checked={answers[item.id] === true}
                  disabled={!canEdit}
                  onChange={() =>
                    setAnswers((current) => ({ ...current, [item.id]: true }))
                  }
                />
                Yes
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name={item.id}
                  checked={answers[item.id] === false}
                  disabled={!canEdit}
                  onChange={() =>
                    setAnswers((current) => ({ ...current, [item.id]: false }))
                  }
                />
                No
              </label>
            </div>
          </li>
        ))}
      </ul>

      {canEdit && (
        <div className="flex flex-wrap items-center gap-3">
          <Button disabled={saving || !allConfirmed} onClick={() => void save()}>
            {saving ? 'Saving…' : 'Save checklist'}
          </Button>
          {!allConfirmed && (
            <p className="text-sm text-muted-foreground">
              Mark every item Yes to enable approve/reject.
            </p>
          )}
          {checklist.isComplete && allConfirmed && (
            <p className="text-sm text-green-700">Checklist complete.</p>
          )}
        </div>
      )}

      {!canEdit && checklist.isComplete && (
        <p className="text-sm text-green-700">Checklist completed.</p>
      )}
    </div>
  );
}

function toChecklistAnswers(
  checklist: ApplicationReviewChecklistStatusDto,
): ApplicationReviewChecklist {
  return {
    idVerified: checklist.items.find((item) => item.id === 'idVerified')?.checked ?? false,
    bankDetailsVerified:
      checklist.items.find((item) => item.id === 'bankDetailsVerified')?.checked ?? false,
    affordabilityReviewed:
      checklist.items.find((item) => item.id === 'affordabilityReviewed')?.checked ?? false,
    purposePlausible:
      checklist.items.find((item) => item.id === 'purposePlausible')?.checked ?? false,
  };
}
