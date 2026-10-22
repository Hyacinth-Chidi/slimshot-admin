import Link from 'next/link';
import { assetHref } from '@/lib/library/kinds';
import { StatusPill } from '@/components/ui/status-pill';
import type { Asset } from '@/lib/api/assets';
import { Artwork, FontTile } from './artwork';
import { formatCreatedDate, formatDownloads, formatDuration } from './format';
import { AssetActionsMenu } from './asset-actions-menu';
import { PlayButton } from './play-button';

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
  const isFont = asset.kind === 'font';
  return (
    <div className="flex min-h-11 items-center gap-3 rounded-lg border border-border bg-surface p-3">
      {isFont ? (
        <FontTile src={asset.previewUrl} title={asset.title} width={84} />
      ) : (
        <Artwork id={asset.id} size={40} src={asset.coverUrl ?? undefined} />
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-text">
          <Link href={assetHref(asset.kind, asset.id)} className="hover:underline">
            {asset.title}
          </Link>
        </p>
        <p className="truncate text-sm text-muted">{isFont ? (asset.face ?? '—') : (asset.author ?? '—')}</p>
        <div className="mt-1 flex items-center gap-2 text-xs text-subtle">
          {!isFont && <span>{formatDuration(asset.durationMs)}</span>}
          {isFont && asset.version !== null && <span>v{asset.version}</span>}
          {!isFont && asset.originalUrl && <PlayButton id={asset.id} title={asset.title} url={asset.originalUrl} />}
          {asset.status ? <StatusPill status={asset.status} /> : null}
          {/* Table and card show the same fields (spec ruling 10) — created was missing here. */}
          {isFont && <span>{formatDownloads(asset.downloadCount)}</span>}
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
