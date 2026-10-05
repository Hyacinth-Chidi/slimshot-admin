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
import { Input } from '@/components/ui/input';
import { deleteUser, type UserDetail } from '@/lib/api/users';
import { formatCredits } from './format';
import { isValidReason, ReasonField } from './reason-field';
import { useUserMutation } from './use-user-mutation';

/** What the admin types to confirm: the email, else the username, else the id. */
export function confirmationTarget(user: Pick<UserDetail, 'id' | 'email' | 'username'>): string {
  return user.email ?? user.username ?? user.id;
}

export function matchesConfirmation(typed: string, target: string): boolean {
  return typed.trim().toLowerCase() === target.trim().toLowerCase();
}

function credits(n: number): string {
  return `${formatCredits(n)} ${n === 1 ? 'credit' : 'credits'}`;
}

function DeleteForm({ user, onClose }: { user: UserDetail; onClose: () => void }) {
  const [reason, setReason] = useState('');
  const [typed, setTyped] = useState('');
  const target = confirmationTarget(user);
  const mutation = useUserMutation((r: string) => deleteUser(user.id, r), {
    success: 'User deleted',
    onDone: onClose,
  });
  const canSubmit = isValidReason(reason) && matchesConfirmation(typed, target) && !mutation.isPending;

  return (
    <form
      className="grid gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (canSubmit) mutation.mutate(reason.trim());
      }}
    >
      <DialogHeader>
        <DialogTitle>Delete this user?</DialogTitle>
        <DialogDescription>
          {`This can't be undone. Their personal data is erased and their ${credits(user.creditBalance)} are forfeited.`}
        </DialogDescription>
      </DialogHeader>

      <ReasonField value={reason} onChange={setReason} />

      <label className="grid gap-2 text-sm">
        <span className="text-muted">{`Type ${target} to confirm`}</span>
        <Input autoComplete="off" spellCheck={false} value={typed} onChange={(e) => setTyped(e.target.value)} />
      </label>

      <DialogFooter>
        <Button type="button" variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" variant="danger" disabled={!canSubmit}>
          {mutation.isPending ? 'Deleting…' : 'Delete'}
        </Button>
      </DialogFooter>
    </form>
  );
}

export function DeleteUserDialog({
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
        <DeleteForm user={user} onClose={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}
