'use client';

import { RotateCw, Upload, X } from 'lucide-react';
import { Artwork } from '@/components/assets/artwork';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { StatusPill, type AssetStatus } from '@/components/ui/status-pill';
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
 *
 * The brand gradient is reserved for exactly four places (primary button,
 * active nav indicator, focus rings, logo mark) — this bar is none of those,
 * so its fill is a flat token, not the gradient.
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
      <div className="h-full w-1/3 animate-pulse bg-[var(--brand-from)]" />
    </div>
  );
}

export function UploadRow({
  item,
  onEdit,
  onStart,
  onRetry,
  onRemove,
}: {
  item: QueueItem;
  onEdit: (fields: Partial<Pick<QueueItem, 'title' | 'author'>>) => void;
  onStart: () => void;
  onRetry: () => void;
  onRemove: () => void;
}) {
  // R9f: rows stay `queued` after being added — title/author are editable
  // right up until the sequence actually starts, and a failed row's fields
  // stay editable too, so a Retry re-sends whatever was last typed rather
  // than the values that failed.
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
          <Input
            value={item.author}
            onChange={(e) => onEdit({ author: e.target.value })}
            disabled={!editable}
            aria-label="Author"
            placeholder="Author (optional)"
          />
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
        {item.status === 'queued' && (
          <Button variant="secondary" size="sm" onClick={onStart}>
            <Upload className="size-4" />
            Upload
          </Button>
        )}
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
