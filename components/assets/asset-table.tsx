'use client';

import { StatusPill } from '@/components/ui/status-pill';
import type { Asset } from '@/lib/api/assets';
import { Artwork } from './artwork';
import { formatCreatedDate, formatDuration } from './format';
import { AssetActionsMenu } from './asset-actions-menu';

export function AssetTable({
  assets,
  selected,
  onToggle,
  onToggleAll,
  onPublish,
  onUnpublish,
  onDelete,
  pendingId,
}: {
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
          <th className="py-2 pr-3 font-medium">Title</th>
          <th className="py-2 pr-3 font-medium">Author</th>
          <th className="py-2 pr-3 font-medium">Duration</th>
          <th className="py-2 pr-3 font-medium">Status</th>
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
                <Artwork id={asset.id} size={32} />
                <span className="font-medium text-text">{asset.title}</span>
              </div>
            </td>
            <td className="py-2 pr-3 text-muted">{asset.author ?? '—'}</td>
            <td className="py-2 pr-3 text-muted">{formatDuration(asset.durationMs)}</td>
            <td className="py-2 pr-3">
              {asset.status ? <StatusPill status={asset.status} /> : <span className="text-subtle">—</span>}
            </td>
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
