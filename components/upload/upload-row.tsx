'use client';

import { RotateCw, X } from 'lucide-react';
import { Artwork } from '@/components/assets/artwork';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { StatusPill, type AssetStatus } from '@/components/ui/status-pill';
import type { Category } from '@/lib/api/categories';
import type { QueueItem } from '@/lib/upload/reducer';

const BUSY_STATES = new Set(['ticketing', 'uploading', 'finalizing']);

function isErrorState(status: QueueItem['status']): boolean {
  return status === 'failed' || status === 'rejected';
}

const STATE_LABEL: Record<QueueItem['status'], string> = {
  queued: 'Queued',
  ticketing: 'Requesting upload…',
  uploading: 'Uploading…',
  finalizing: 'Finalizing…',
  done: 'Done',
  failed: 'Failed',
  rejected: 'Rejected',
};

/**
 * No byte-level progress is available (R9c: the brief's tests mock `fetch`,
 * which reports no upload progress events) — the bar is indeterminate while
 * a state in BUSY_STATES is active, and full once `done`.
 */
function ProgressBar({ status }: { status: QueueItem['status'] }) {
  if (status === 'done') {
    return (
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-elevated">
        <div className="h-full w-full bg-success" />
      </div>
    );
  }

  if (!BUSY_STATES.has(status)) return null;

  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-elevated" role="progressbar" aria-label="Uploading">
      <div className="h-full w-1/3 animate-pulse bg-[linear-gradient(135deg,var(--brand-from)_0%,var(--brand-to)_100%)]" />
    </div>
  );
}

export function UploadRow({
  item,
  categories,
  onEdit,
  onRetry,
  onRemove,
}: {
  item: QueueItem;
  categories: { category: Category; depth: number }[];
  onEdit: (fields: Partial<Pick<QueueItem, 'title' | 'author' | 'categoryId'>>) => void;
  onRetry: () => void;
  onRemove: () => void;
}) {
  const editable = item.status === 'queued' || item.status === 'failed';
  const busy = BUSY_STATES.has(item.status);

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-3">
      <div className="flex items-start gap-3">
        <Artwork id={item.id} size={40} />
        <div className="min-w-0 flex-1 flex flex-col gap-2">
          <Input
            value={item.title}
            onChange={(e) => onEdit({ title: e.target.value })}
            disabled={!editable}
            aria-label="Title"
            placeholder="Title"
          />
          <div className="flex flex-col gap-2 md:flex-row">
            <Input
              value={item.author}
              onChange={(e) => onEdit({ author: e.target.value })}
              disabled={!editable}
              aria-label="Author"
              placeholder="Author (optional)"
              className="md:flex-1"
            />
            <Select
              value={item.categoryId ?? 'none'}
              onValueChange={(v) => onEdit({ categoryId: v === 'none' ? undefined : v })}
              disabled={!editable}
            >
              <SelectTrigger className="md:flex-1" aria-label="Category">
                <SelectValue placeholder="No category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No category</SelectItem>
                {categories.map(({ category, depth }) => (
                  <SelectItem key={category.id} value={category.id}>
                    {`${'— '.repeat(depth)}${category.name}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {item.status === 'done' && item.assetStatus ? (
          <StatusPill status={item.assetStatus as AssetStatus} />
        ) : (
          <Button
            variant="ghost"
            size="sm"
            className="h-11 w-11 shrink-0 md:h-8 md:w-8"
            aria-label="Remove"
            onClick={onRemove}
            disabled={busy}
          >
            <X className="size-4" />
          </Button>
        )}
      </div>

      <ProgressBar status={item.status} />

      <div className="flex items-center justify-between gap-2 text-xs">
        <span className={isErrorState(item.status) ? 'text-error' : item.status === 'done' ? 'text-success' : 'text-subtle'}>
          {isErrorState(item.status) ? item.error : STATE_LABEL[item.status]}
        </span>
        {/* Only `failed` gets Retry: it ran uploadFile's ticket/upload/finalize
            sequence and a server/network step rejected it, so re-running that
            sequence can succeed. `rejected` never reached uploadFile — the
            extension still won't match the kind on a retry, so there is
            nothing a retry would change; the file has to be re-added with the
            right kind or swapped for a different file instead. */}
        {item.status === 'failed' && (
          <Button variant="secondary" size="sm" onClick={onRetry}>
            <RotateCw className="size-4" />
            Retry
          </Button>
        )}
      </div>
    </div>
  );
}
