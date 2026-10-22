'use client';

import Link from 'next/link';
import { assetHref } from '@/lib/library/kinds';
import { StatusPill } from '@/components/ui/status-pill';
import type { Asset } from '@/lib/api/assets';
import { Artwork, FontTile } from './artwork';
import { formatCreatedDate, formatDuration } from './format';
import { AssetActionsMenu } from './asset-actions-menu';
import { PlayButton } from './play-button';

export function AssetTable({
  kind = 'audio',
  assets,
  selected,
  onToggle,
  onToggleAll,
  onPublish,
  onUnpublish,
  onDelete,
  pendingId,
}: {
  /** The section's kind: fonts show their preview and drop the sound columns. */
  kind?: string;
  assets: Asset[];
  /** Bulk selection is optional: the desktop-only extra from spec §6.2. */
  selected?: Set<string>;
  onToggle?: (id: string) => void;
  onToggleAll?: (checked: boolean) => void;
  onPublish: (id: string) => void;
  onUnpublish: (id: string) => void;
  onDelete: (id: string) => void;
  /** The asset id with an in-flight mutation, if any. */
  pendingId?: string | null;
}) {
  const allSelected = selected !== undefined && assets.length > 0 && selected.size === assets.length;
  const isFont = kind === 'font';

  return (
    <table className="w-full border-collapse text-sm">
      <thead>
        <tr className="border-b border-border text-left text-xs text-muted">
          {selected !== undefined && (
            <th className="w-10 py-2 pr-2">
              <input
                type="checkbox"
                aria-label="Select all assets"
                checked={allSelected}
                onChange={(e) => onToggleAll?.(e.target.checked)}
              />
            </th>
          )}
          <th className="py-2 pr-3 font-medium">{isFont ? 'Font' : 'Title'}</th>
          {isFont && (
            <>
              <th className="py-2 pr-3 font-medium">Family and style</th>
              <th className="py-2 pr-3 font-medium">Version</th>
            </>
          )}
          {!isFont && (
            <>
              <th className="py-2 pr-3 font-medium">Author</th>
              <th className="py-2 pr-3 font-medium">Duration</th>
              <th className="py-2 pr-3">
                <span className="sr-only">Play</span>
              </th>
            </>
          )}
          <th className="py-2 pr-3 font-medium">Status</th>
          {isFont && <th className="py-2 pr-3 font-medium">Downloads</th>}
          <th className="py-2 pr-3 font-medium">Created</th>
          <th className="w-10 py-2" />
        </tr>
      </thead>
      <tbody>
        {assets.map((asset) => (
          <tr
            key={asset.id}
            className="group border-b border-border last:border-0 hover:bg-elevated"
          >
            {selected !== undefined && (
              <td className="py-2 pr-2">
                <input
                  type="checkbox"
                  aria-label={`Select ${asset.title}`}
                  checked={selected.has(asset.id)}
                  onChange={() => onToggle?.(asset.id)}
                />
              </td>
            )}
            <td className="py-2 pr-3">
              <div className="flex items-center gap-3">
                {isFont ? (
                  <FontTile src={asset.previewUrl} title={asset.title} />
                ) : (
                  <Artwork id={asset.id} size={32} src={asset.coverUrl ?? undefined} />
                )}
                <Link href={assetHref(asset.kind, asset.id)} className="font-medium text-text hover:underline">
                  {asset.title}
                </Link>
              </div>
            </td>
            {/* Display names can be edited and repeated; the face read from
                the file and the version are what tell two fonts apart. */}
            {isFont && (
              <>
                <td className="py-2 pr-3 text-muted">{asset.face ?? '—'}</td>
                <td className="py-2 pr-3 text-muted">{asset.version ? `v${asset.version}` : '—'}</td>
              </>
            )}
            {!isFont && (
              <>
                <td className="py-2 pr-3 text-muted">{asset.author ?? '—'}</td>
                <td className="py-2 pr-3 text-muted">{formatDuration(asset.durationMs)}</td>
                <td className="py-2 pr-3 text-center">
                  {asset.originalUrl && <PlayButton id={asset.id} title={asset.title} url={asset.originalUrl} />}
                </td>
              </>
            )}
            <td className="py-2 pr-3">
              {asset.status ? <StatusPill status={asset.status} /> : <span className="text-subtle">—</span>}
            </td>
            {isFont && <td className="py-2 pr-3 tabular-nums text-muted">{asset.downloadCount.toLocaleString('en-US')}</td>}
            <td className="py-2 pr-3 text-muted">{formatCreatedDate(asset.createdAt)}</td>
            <td className="py-2">
              {/* Hover actions (desktop-only extra, spec §6.2): dim until the row is
                  hovered, so they don't fight the 40+ rows a dense table can hold.
                  Tailwind v4's hover: only applies under (hover: hover), so a touch
                  device at md+ (an iPad) always shows them (pointer-coarse), and they
                  stay visible while the trigger has focus or its menu is open. */}
              <div className="opacity-0 transition-opacity duration-150 ease-out group-hover:opacity-100 pointer-coarse:opacity-100 focus-within:opacity-100 has-[[data-state=open]]:opacity-100">
                <AssetActionsMenu
                  asset={asset}
                  onPublish={onPublish}
                  onUnpublish={onUnpublish}
                  onDelete={onDelete}
                  pending={pendingId === asset.id}
                />
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
