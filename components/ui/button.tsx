'use client';

import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

// The brand gradient appears in exactly four places across the app; the
// primary button is one of them. Do not add it to another variant.
const VARIANTS: Record<Variant, string> = {
  primary:
    'bg-[linear-gradient(135deg,var(--brand-from)_0%,var(--brand-to)_100%)] text-white hover:opacity-90',
  secondary: 'bg-elevated text-text border border-border hover:bg-border',
  ghost: 'text-muted hover:bg-elevated hover:text-text',
  danger: 'bg-error/10 text-error border border-error/30 hover:bg-error/20',
};

const SIZES: Record<Size, string> = {
  // 44px minimum height below md, per the responsive strategy.
  sm: 'h-11 px-3 text-sm md:h-8',
  md: 'h-11 px-4 text-sm md:h-10',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'secondary', size = 'md', ...props }, ref) => (
    <button
      ref={ref}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-lg font-medium',
        'transition-opacity duration-150 ease-out',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-from)]',
        'disabled:pointer-events-none disabled:opacity-50',
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...props}
    />
  ),
);
Button.displayName = 'Button';
