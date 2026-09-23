import { cn } from '@/lib/cn';

export type AssetStatus =
  | 'draft'
  | 'processing'
  | 'ready'
  | 'published'
  | 'archived'
  | 'failed';

const STYLES: Record<AssetStatus, { label: string; className: string }> = {
  draft: { label: 'Draft', className: 'bg-elevated text-muted border-border' },
  processing: { label: 'Processing', className: 'bg-warning/10 text-warning border-warning/30' },
  ready: { label: 'Ready', className: 'bg-elevated text-text border-border' },
  published: { label: 'Published', className: 'bg-success/10 text-success border-success/30' },
  archived: { label: 'Archived', className: 'bg-elevated text-subtle border-border' },
  failed: { label: 'Failed', className: 'bg-error/10 text-error border-error/30' },
};

export function StatusPill({ status }: { status: AssetStatus }) {
  // Falls back to the raw value rather than crashing: the API's enum may gain
  // a status this build has never heard of.
  const style = STYLES[status] ?? {
    label: String(status),
    className: 'bg-elevated text-muted border-border',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium',
        style.className,
      )}
    >
      {style.label}
    </span>
  );
}
