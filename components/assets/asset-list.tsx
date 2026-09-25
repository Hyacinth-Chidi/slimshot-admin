import type { Asset } from '@/lib/api/assets';
import { AssetCard } from './asset-card';
import { AssetTable } from './asset-table';

const NOOP = () => {};

export function AssetList({
  assets,
  selected,
  onToggle,
  onToggleAll,
  onPublish = NOOP,
  onUnpublish = NOOP,
  onDelete = NOOP,
  pendingId = null,
}: {
  assets: Asset[];
  /** Bulk selection, desktop-only (spec §6.2): omit to render without it. */
  selected?: Set<string>;
  onToggle?: (id: string) => void;
  onToggleAll?: (checked: boolean) => void;
  onPublish?: (id: string) => void;
  onUnpublish?: (id: string) => void;
  onDelete?: (id: string) => void;
  pendingId?: string | null;
}) {
  if (assets.length === 0) {
    return <p className="py-12 text-center text-sm text-subtle">No assets yet.</p>;
  }

  return (
    <>
      <div data-testid="asset-table" className="hidden md:block">
        <AssetTable
          assets={assets}
          selected={selected}
          onToggle={onToggle}
          onToggleAll={onToggleAll}
          onPublish={onPublish}
          onUnpublish={onUnpublish}
          onDelete={onDelete}
          pendingId={pendingId}
        />
      </div>
      <div data-testid="asset-cards" className="flex flex-col gap-2 md:hidden">
        {assets.map((a) => (
          <AssetCard
            key={a.id}
            asset={a}
            onPublish={onPublish}
            onUnpublish={onUnpublish}
            onDelete={onDelete}
            pending={pendingId === a.id}
          />
        ))}
      </div>
    </>
  );
}
