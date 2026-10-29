'use client';

import { cn } from '@/lib/cn';
import { dismissToast, useToasts } from '@/lib/use-toast';

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
          <div className="flex items-center gap-4">
            <span>{t.message}</span>
            {t.action && (
              <button
                type="button"
                className="min-h-11 shrink-0 rounded-md px-3 py-1 font-semibold md:min-h-0 md:px-2 text-text underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-from)]"
                onClick={() => {
                  dismissToast(t.id);
                  t.action?.onClick();
                }}
              >
                {t.action.label}
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
