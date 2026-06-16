'use client';

import {
  SUPPORT_TICKET_CATEGORY_LABELS,
  type CreateSupportTicketInput,
  type SupportTicketCategory,
} from '@lms/types';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type Props = {
  onSubmit: (input: CreateSupportTicketInput) => Promise<void>;
};

export function SupportTicketForm({ onSubmit }: Props) {
  const [category, setCategory] = useState<SupportTicketCategory>('OTHER');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      await onSubmit({ category, subject, description });
      setSubject('');
      setDescription('');
      setCategory('OTHER');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not submit issue');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={(event) => void handleSubmit(event)} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="support-category">Category</Label>
        <select
          id="support-category"
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
          value={category}
          onChange={(event) => setCategory(event.target.value as SupportTicketCategory)}
        >
          {Object.entries(SUPPORT_TICKET_CATEGORY_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="support-subject">Subject</Label>
        <Input
          id="support-subject"
          value={subject}
          onChange={(event) => setSubject(event.target.value)}
          placeholder="Brief summary of your issue"
          required
          minLength={3}
          maxLength={200}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="support-description">Details</Label>
        <textarea
          id="support-description"
          className="flex min-h-[140px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="Describe what happened, who was involved, and what you need from LMS."
          required
          minLength={10}
        />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button type="submit" disabled={submitting}>
        {submitting ? 'Submitting…' : 'Submit to LMS'}
      </Button>
    </form>
  );
}
