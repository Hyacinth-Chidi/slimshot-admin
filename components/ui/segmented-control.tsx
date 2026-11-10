'use client';

import { cn } from '@/lib/cn';

/**
 * A choice of one among a few, as pills (the asset filters' look): a radio
 * group, 44px targets below md. Scrolls within itself if it ever outgrows a
 * phone, never the page.
 */
export function SegmentedControl<T extends string>({
  label,
  options,
  value,
  onChange,
  className,
}: {
  label: string;
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className={cn('flex gap-1 overflow-x-auto', className)}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(option.value)}
            className={cn(
              'h-11 shrink-0 rounded-lg border px-3 text-sm font-medium transition-colors duration-150 ease-out md:h-8',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-from)]',
              active ? 'border-transparent bg-elevated text-text' : 'border-border bg-transparent text-muted hover:bg-elevated',
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
