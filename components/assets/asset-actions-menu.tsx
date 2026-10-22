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
 * Publish is only valid from ready/archived, matching asset.service.ts:19-22
 * (PUBLISHABLE_FROM) — and the server enforces this itself (a 400 with a
 * readable message otherwise, asset.service.ts:100-105), so offering it
 * whenever status is unknown is safe: the worst case is a rejected mutation
 * with a clear error toast.
 *
 * Unpublish is different: AssetService.unpublish (asset.service.ts:129-152)
 * has NO status guard at all — it unconditionally sets status to `ready`.
 * Offering "Unpublish" on an asset whose status is unknown (null, because
 * the list isn't filtered by status — see lib/api/assets.ts's R8e comment)
 * could silently move a draft/processing/failed/archived asset to `ready`,
 * which is not what "unpublish" means for any of those. So canUnpublish only
 * returns true when status is truthfully known to be `published`.
 */
export function canPublish(status: Asset['status']): boolean {
  return status === null || status === 'ready' || status === 'archived';
}

export function canUnpublish(status: Asset['status']): boolean {
  return status === 'published';
}

/**
 * Presentational only — no useMutation/useQueryClient here. The list
 * components (AssetTable/AssetCard) render outside any
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
      {/* modal={false}: a DropdownMenuItem's onSelect opens the delete Dialog
          (a Radix Dialog, itself modal). Radix's menu-close and dialog-open
          animations can overlap; when the menu is modal, its unmount can
          leave `body { pointer-events: none }` set after the dialog it
          triggered has also closed, because the two Radix roots each try to
          own that lock. The dropdown doesn't need to be modal — it's a small
          menu over an already-interactive page — so this sidesteps the
          conflict entirely, tested in asset-actions-menu.test.tsx. */}
      <DropdownMenu modal={false}>
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
