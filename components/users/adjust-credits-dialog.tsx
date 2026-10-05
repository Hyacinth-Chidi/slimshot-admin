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
import { adjustCredits, type UserDetail } from '@/lib/api/users';
import { cn } from '@/lib/cn';
import { displayName, formatCredits } from './format';
import { isValidReason, ReasonField } from './reason-field';
import { isValidationError, useUserMutation } from './use-user-mutation';

const MAX_AMOUNT = 1_000_000;

function belowZeroLine(balance: number): string {
  return `This would take the balance below zero. Current balance: ${formatCredits(balance)}.`;
}

function serverBalance(error: unknown): number | null {
  if (!isValidationError(error)) return null;
  const balance = (error.details as { balance?: unknown } | undefined)?.balance;
  return typeof balance === 'number' ? balance : null;
}

/** Lives inside DialogContent, so closing the dialog drops what was typed. */
function AdjustForm({ user, onClose }: { user: UserDetail; onClose: () => void }) {
  const [direction, setDirection] = useState<'add' | 'remove'>('add');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const mutation = useUserMutation(
    (vars: { amount: number; reason: string }) => adjustCredits(user.id, vars.amount, vars.reason),
    { success: 'Credits adjusted', onDone: onClose },
  );

  const digits = amount.trim();
  const value = /^\d+$/.test(digits) ? Number(digits) : NaN;
  const validAmount = Number.isInteger(value) && value >= 1 && value <= MAX_AMOUNT;
  const signed = direction === 'add' ? value : -value;
  const newBalance = validAmount ? user.creditBalance + signed : null;
  const belowZero = newBalance !== null && newBalance < 0;
  const reported = serverBalance(mutation.error);
  const canSubmit = validAmount && !belowZero && isValidReason(reason) && !mutation.isPending;

  return (
    <form
      className="grid gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (canSubmit) mutation.mutate({ amount: signed, reason: reason.trim() });
      }}
    >
      <DialogHeader>
        <DialogTitle>Adjust credits</DialogTitle>
        <DialogDescription>
          {`${displayName(user)} has ${formatCredits(user.creditBalance)} credits. The change and its reason go in their history and the audit log.`}
        </DialogDescription>
      </DialogHeader>

      <div className="grid grid-cols-2 gap-2" role="group" aria-label="Direction">
        {(['add', 'remove'] as const).map((d) => (
          <Button
            key={d}
            type="button"
            variant="secondary"
            aria-pressed={direction === d}
            onClick={() => setDirection(d)}
            className={cn(direction === d && 'border-text text-text')}
          >
            {d === 'add' ? 'Add' : 'Remove'}
          </Button>
        ))}
      </div>

      <label className="grid gap-2 text-sm">
        <span className="text-muted">Amount</span>
        <Input
          inputMode="numeric"
          autoComplete="off"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          aria-invalid={belowZero || reported !== null ? true : undefined}
        />
      </label>

      {belowZero ? (
        <p role="alert" className="text-sm text-error">
          {belowZeroLine(user.creditBalance)}
        </p>
      ) : reported !== null ? (
        <p role="alert" className="text-sm text-error">
          {belowZeroLine(reported)}
        </p>
      ) : newBalance !== null ? (
        <p className="text-sm text-muted">New balance: {formatCredits(newBalance)}</p>
      ) : null}

      <ReasonField value={reason} onChange={setReason} />

      <DialogFooter>
        <Button type="button" variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" disabled={!canSubmit}>
          {mutation.isPending ? 'Saving…' : 'Save adjustment'}
        </Button>
      </DialogFooter>
    </form>
  );
}

export function AdjustCreditsDialog({
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
        <AdjustForm user={user} onClose={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}
