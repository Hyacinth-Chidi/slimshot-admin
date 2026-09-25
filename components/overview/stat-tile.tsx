import { cn } from '@/lib/cn';

export function StatTile({
  label,
  value,
  className,
}: {
  label: string;
  /** A formatted string, or undefined while loading (renders "—"). */
  value: string | number | undefined;
  className?: string;
}) {
  return (
    <div className={cn('rounded-lg border border-border bg-surface p-4', className)}>
      <p className="text-sm text-muted">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-text">{value ?? '—'}</p>
    </div>
  );
}
