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
import { suspendUser, type UserDetail } from '@/lib/api/users';
import { displayName } from './format';
import { isValidReason, ReasonField } from './reason-field';
import { useUserMutation } from './use-user-mutation';

function SuspendForm({ user, onClose }: { user: UserDetail; onClose: () => void }) {
  const [reason, setReason] = useState('');
  const mutation = useUserMutation((r: string) => suspendUser(user.id, r), {
    success: 'User suspended',
    onDone: onClose,
  });
  const canSubmit = isValidReason(reason) && !mutation.isPending;

  return (
    <form
      className="grid gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (canSubmit) mutation.mutate(reason.trim());
      }}
    >
      <DialogHeader>
        <DialogTitle>{`Suspend ${displayName(user)}?`}</DialogTitle>
        <DialogDescription>
          They stay signed in but can&apos;t spend credits, earn from ads or claim a bonus.
        </DialogDescription>
      </DialogHeader>

      <ReasonField value={reason} onChange={setReason} />

      <DialogFooter>
        <Button type="button" variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" variant="danger" disabled={!canSubmit}>
          {mutation.isPending ? 'Suspending…' : 'Suspend'}
        </Button>
      </DialogFooter>
    </form>
  );
}

export function SuspendDialog({
  user,
  open,
  onOpenChange,
}: {
  user: UserDetail;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <SuspendForm user={user} onClose={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}
