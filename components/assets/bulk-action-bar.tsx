'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

/** Desktop-only bulk bar (spec §6.2 "bulk selection"): appears once rows are checked. */
export function BulkActionBar({
  count,
  onPublish,
  onUnpublish,
  onDelete,
  pending,
}: {
  count: number;
  onPublish: () => void;
  onUnpublish: () => void;
  onDelete: () => void;
  pending: boolean;
}) {
  const [confirmOpen, setConfirmOpen] = useState(false);

  if (count === 0) return null;

  return (
    <div className="hidden items-center justify-between gap-3 rounded-lg border border-border bg-elevated px-4 py-2 md:flex">
      <span className="text-sm text-text">{count} selected</span>
      <div className="flex items-center gap-2">
        <Button variant="secondary" size="sm" onClick={onPublish} disabled={pending}>
          Publish
        </Button>
        <Button variant="secondary" size="sm" onClick={onUnpublish} disabled={pending}>
          Unpublish
        </Button>
        <Button variant="danger" size="sm" onClick={() => setConfirmOpen(true)} disabled={pending}>
          Delete
        </Button>
      </div>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {count} assets?</DialogTitle>
            <DialogDescription>This cannot be undone.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setConfirmOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                onDelete();
                setConfirmOpen(false);
              }}
              disabled={pending}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
