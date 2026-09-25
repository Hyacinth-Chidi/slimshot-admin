'use client';

import Link from 'next/link';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ApiError } from '@/lib/api/client';

/**
 * R10a: the 409 "view blocking assets" link is scoped to the category being
 * deleted when the caller has an id to give it — `/assets?categoryId=<id>` —
 * and falls back to the unscoped `/assets` list otherwise. `categoryId` is
 * optional and deliberately unused by the brief's own tests (Step 2), which
 * render the dialog without it and must keep passing unmodified.
 */
export function DeleteDialog({
  open,
  name,
  categoryId,
  error,
  onConfirm,
  onClose,
  pending = false,
}: {
  open: boolean;
  name: string;
  categoryId?: string;
  error: ApiError | null;
  onConfirm: () => void;
  onClose: () => void;
  pending?: boolean;
}) {
  const isConflict = error?.status === 409;
  const viewHref = categoryId ? `/assets?categoryId=${encodeURIComponent(categoryId)}` : '/assets';

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{`Delete "${name}"?`}</DialogTitle>
          <DialogDescription>
            {isConflict ? (
              <>
                {error.message}{' '}
                <Link href={viewHref}>View</Link>
              </>
            ) : (
              'This cannot be undone.'
            )}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          {!isConflict && (
            <Button variant="danger" onClick={onConfirm} disabled={pending}>
              {pending ? 'Deleting…' : 'Delete'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
