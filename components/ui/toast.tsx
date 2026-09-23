'use client';

import { cn } from '@/lib/cn';
import { useToasts } from '@/lib/use-toast';

export function Toaster() {
  const toasts = useToasts();

  return (
    <div className="pointer-events-none fixed bottom-20 right-4 z-50 flex flex-col gap-2 md:bottom-4">
      {toasts.map((t) => (
        <div
          key={t.id}
          role="status"
          className={cn(
            'pointer-events-auto rounded-lg border px-4 py-3 text-sm',
            'bg-surface text-text',
            t.variant === 'error' && 'border-error/40',
            t.variant === 'success' && 'border-success/40',
            t.variant === 'default' && 'border-border',
          )}
        >
          {t.message}
        </div>
      ))}
    </div>
  );
}
