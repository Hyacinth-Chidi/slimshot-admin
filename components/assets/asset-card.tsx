import { StatusPill } from '@/components/ui/status-pill';
import type { Asset } from '@/lib/api/assets';
import { Artwork } from './artwork';
import { formatCreatedDate, formatDuration } from './format';
import { AssetActionsMenu } from './asset-actions-menu';

export function AssetCard({
  asset,
  onPublish,
  onUnpublish,
  onDelete,
  pending = false,
}: {
  asset: Asset;
  onPublish: (id: string) => void;
  onUnpublish: (id: string) => void;
  onDelete: (id: string) => void;
  pending?: boolean;
}) {
  return (
    <div className="flex min-h-11 items-center gap-3 rounded-lg border border-border bg-surface p-3">
      <Artwork id={asset.id} size={40} />
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-text">{asset.title}</p>
        <p className="truncate text-sm text-muted">{asset.author ?? '—'}</p>
        <div className="mt-1 flex items-center gap-2 text-xs text-subtle">
          <span>{formatDuration(asset.durationMs)}</span>
          {asset.status ? <StatusPill status={asset.status} /> : null}
          {/* Table and card show the same fields (spec ruling 10) — created was missing here. */}
          <span>{formatCreatedDate(asset.createdAt)}</span>
        </div>
      </div>
      <AssetActionsMenu
        asset={asset}
        className="h-11 w-11 shrink-0 md:h-8 md:w-8"
        onPublish={onPublish}
        onUnpublish={onUnpublish}
        onDelete={onDelete}
        pending={pending}
      />
    </div>
  );
}
