'use client';

import { useEffect, useId, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  formatCentsForInput,
  formatRandDisplay,
  parseRandInputToCents,
} from '@/lib/money-input';
import { cn } from '@/lib/utils';

export function MoneyInput({
  id: idProp,
  label = 'Amount (Rand)',
  valueCents,
  onChangeCents,
  disabled,
  required,
  className,
  hint,
}: {
  id?: string;
  label?: string;
  valueCents: number | null | undefined;
  onChangeCents: (cents: number | null) => void;
  disabled?: boolean;
  required?: boolean;
  className?: string;
  hint?: string;
}) {
  const autoId = useId();
  const id = idProp ?? autoId;
  const [text, setText] = useState(() => formatCentsForInput(valueCents));
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!focused) {
      setText(formatCentsForInput(valueCents));
    }
  }, [valueCents, focused]);

  const preview = formatRandDisplay(valueCents);

  return (
    <div className={cn('space-y-2', className)}>
      {label ? (
        <Label htmlFor={id}>
          {label}
          {required && <span className="text-destructive"> *</span>}
        </Label>
      ) : null}
      <div className="relative">
        <span
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium text-muted-foreground"
          aria-hidden="true"
        >
          R
        </span>
        <Input
          id={id}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          disabled={disabled}
          required={required}
          placeholder="0.00"
          className="pl-8"
          value={text}
          onFocus={() => setFocused(true)}
          onBlur={() => {
            setFocused(false);
            const cents = parseRandInputToCents(text);
            if (text.trim() === '') {
              onChangeCents(null);
              setText('');
              return;
            }
            if (cents != null) {
              onChangeCents(cents);
              setText(formatCentsForInput(cents));
            }
          }}
          onChange={(event) => {
            const next = event.target.value;
            setText(next);
            const cents = parseRandInputToCents(next);
            if (next.trim() === '') {
              onChangeCents(null);
            } else if (cents != null) {
              onChangeCents(cents);
            }
          }}
        />
      </div>
      {(hint || preview) && (
        <p className="text-xs text-muted-foreground">
          {hint ?? (preview ? `Equals ${preview}` : 'Enter amount in South African Rand')}
        </p>
      )}
    </div>
  );
}
