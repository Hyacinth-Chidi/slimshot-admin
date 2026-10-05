'use client';

import { cn } from '@/lib/cn';

export const REASON_MIN = 3;
export const REASON_MAX = 500;

export function isValidReason(reason: string): boolean {
  const length = reason.trim().length;
  return length >= REASON_MIN && length <= REASON_MAX;
}

/** Every user action records why in the audit log; the server requires 3–500 characters. */
export function ReasonField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <label className="grid gap-2 text-sm">
      <span className="text-muted">Reason</span>
      <textarea
        rows={3}
        maxLength={REASON_MAX}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          'w-full resize-none rounded-lg border border-border bg-elevated px-3 py-2 text-sm text-text',
          'placeholder:text-subtle',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-from)]',
        )}
        placeholder="Recorded in the audit log"
      />
    </label>
  );
}
