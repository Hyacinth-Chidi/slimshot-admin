'use client';

import { useState } from 'react';
import { MoreVertical } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import type { Asset } from '@/lib/api/assets';
import { DeleteAssetDialog } from './delete-asset-dialog';

/**
 * Publish is only offered from ready/archived, matching
 * asset.service.ts:19-22 (PUBLISHABLE_FROM). Unpublish always returns the
 * asset to `ready` (asset.service.ts:129-152) so it's offered whenever the
 * asset is currently published. Status is unknown for list items today (see
 * lib/api/assets.ts) — when it's null both actions are offered and the
 * server's own transition check (a 400 with a readable message) is the
 * backstop, surfaced via the caller's mutation error toast.
 */
export function canPublish(status: Asset['status']): boolean {
  return status === null || status === 'ready' || status === 'archived';
}

export function canUnpublish(status: Asset['status']): boolean {
  return status === null || status === 'published';
}

/**
 * Presentational only — no useMutation/useQueryClient here. The list
 * components (AssetTable/AssetCard/AssetList) render outside any
 * QueryClientProvider in their unit tests, so the actual mutations live in
 * the page and arrive as callbacks.
 */
export function AssetActionsMenu({
  asset,
  className,
  onPublish,
  onUnpublish,
  onDelete,
  pending = false,
}: {
  asset: Asset;
  className?: string;
  onPublish: (id: string) => void;
  onUnpublish: (id: string) => void;
  onDelete: (id: string) => void;
  pending?: boolean;
}) {
  const [confirmOpen, setConfirmOpen] = useState(false);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className={className}
            aria-label={`Actions for ${asset.title}`}
          >
            <MoreVertical className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {canPublish(asset.status) && (
            <DropdownMenuItem onSelect={() => onPublish(asset.id)} disabled={pending}>
              Publish
            </DropdownMenuItem>
          )}
          {canUnpublish(asset.status) && (
            <DropdownMenuItem onSelect={() => onUnpublish(asset.id)} disabled={pending}>
              Unpublish
            </DropdownMenuItem>
          )}
          <DropdownMenuItem variant="destructive" onSelect={() => setConfirmOpen(true)}>
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <DeleteAssetDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={asset.title}
        pending={pending}
        onConfirm={() => {
          onDelete(asset.id);
          setConfirmOpen(false);
        }}
      />
    </>
  );
}
