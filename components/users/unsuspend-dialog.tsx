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
import { unsuspendUser, type UserDetail } from '@/lib/api/users';
import { displayName } from './format';
import { useUserMutation } from './use-user-mutation';

function UnsuspendConfirm({ user, onClose }: { user: UserDetail; onClose: () => void }) {
  const mutation = useUserMutation(() => unsuspendUser(user.id), {
    success: 'Suspension lifted',
    onDone: onClose,
  });

  return (
    <>
      <DialogHeader>
        <DialogTitle>{`Lift ${displayName(user)}'s suspension?`}</DialogTitle>
        <DialogDescription>They can spend credits, earn from ads and claim again.</DialogDescription>
      </DialogHeader>
      <DialogFooter>
        <Button type="button" variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button
          type="button"
          variant="primary"
          disabled={mutation.isPending}
          onClick={() => mutation.mutate(undefined)}
        >
          {mutation.isPending ? 'Lifting…' : 'Unsuspend'}
        </Button>
      </DialogFooter>
    </>
  );
}

export function UnsuspendDialog({
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
        <UnsuspendConfirm user={user} onClose={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}
