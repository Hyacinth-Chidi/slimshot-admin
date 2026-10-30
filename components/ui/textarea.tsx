'use client';

import { forwardRef, type TextareaHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

/** A multi-line Input: same surface, border, focus ring and type. */
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(
        'min-h-24 w-full rounded-lg border border-border bg-elevated px-3 py-2.5 text-sm text-text',
        'placeholder:text-subtle',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-from)]',
        'disabled:opacity-60',
        className,
      )}
      {...props}
    />
  ),
);
Textarea.displayName = 'Textarea';
