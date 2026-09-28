'use client';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export function RemoveKeyDialog({
  open,
  providerLabel,
  active,
  pending,
  onConfirm,
  onClose,
}: {
  open: boolean;
  providerLabel: string;
  active: boolean;
  pending: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{`Remove the ${providerLabel} key?`}</DialogTitle>
          <DialogDescription>
            {active
              ? `${providerLabel} is the active provider. Auto caption stops working in the app until another provider is made active.`
              : 'You can add a key again at any time.'}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="danger" onClick={onConfirm} disabled={pending}>
            {pending ? 'Removing…' : 'Remove key'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
