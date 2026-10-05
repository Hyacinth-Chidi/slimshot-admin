import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

/**
 * A placeholder block shaped like content that is on its way. Decorative only:
 * the LoadingRegion around it is what assistive technology hears. The pulse
 * holds still for people who ask their device for reduced motion.
 */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn('animate-pulse rounded-md bg-elevated motion-reduce:animate-none', className)}
    />
  );
}

/**
 * Wraps a skeleton. Screen readers hear "Loading users" (the label) once; nothing
 * is shown as text, which is the dashboard's rule for loading states.
 */
export function LoadingRegion({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div role="status" aria-label={label} aria-busy="true" className={className}>
      <span className="sr-only">{label}</span>
      {children}
    </div>
  );
}

/** Varied line widths, so a column of skeleton rows reads like real text. */
export const SKELETON_WIDTHS = ['w-32', 'w-44', 'w-28', 'w-40', 'w-36', 'w-24', 'w-48', 'w-30'] as const;

export function skeletonWidth(i: number): string {
  return SKELETON_WIDTHS[i % SKELETON_WIDTHS.length];
}
