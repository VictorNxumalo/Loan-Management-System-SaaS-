'use client';

import type { BorrowerSearchResultDto } from '@lms/types';
import { useEffect, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useApi } from '@/lib/use-api';

interface BorrowerSearchProps {
  value: BorrowerSearchResultDto | null;
  onChange: (borrower: BorrowerSearchResultDto | null) => void;
  error?: string;
}

export function BorrowerSearch({ value, onChange, error }: BorrowerSearchProps) {
  const api = useApi();
  const [query, setQuery] = useState(value?.label ?? '');
  const [results, setResults] = useState<BorrowerSearchResultDto[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!query.trim() || query === value?.label) {
      setResults([]);
      return;
    }

    const timer = setTimeout(() => {
      void api<BorrowerSearchResultDto[]>(
        `/borrowers/search?q=${encodeURIComponent(query.trim())}`,
      )
        .then(setResults)
        .catch(() => setResults([]));
    }, 300);

    return () => clearTimeout(timer);
  }, [api, query, value?.label]);

  return (
    <div className="relative space-y-2">
      <Label htmlFor="borrowerSearch">Borrower</Label>
      <Input
        id="borrowerSearch"
        value={query}
        placeholder="Search by name or ID number"
        onChange={(e) => {
          setQuery(e.target.value);
          onChange(null);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
      />
      {error && <p className="text-sm text-destructive">{error}</p>}
      {open && results.length > 0 && (
        <ul className="absolute z-10 mt-1 max-h-48 w-full overflow-auto rounded-md border bg-background shadow-md">
          {results.map((result) => (
            <li key={result.id}>
              <button
                type="button"
                className="w-full px-3 py-2 text-left text-sm hover:bg-muted"
                onClick={() => {
                  onChange(result);
                  setQuery(result.label);
                  setOpen(false);
                }}
              >
                {result.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
