'use client';

import { useId, useRef, useState, type FormEvent } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

/**
 * Resolves to null when the unlock succeeded, or to the message to show when
 * it did not. The modal never throws the password anywhere — it hands it to
 * this callback once and forgets it.
 */
export type UnlockHandler = (password: string) => Promise<string | null>;

/**
 * Spec §6.5: the password lives in this component's local state only — never
 * a form library, the query cache, storage or a URL. It is cleared the
 * moment it is submitted (so it is gone before the reveal request resolves,
 * success or failure), and the form itself unmounts with the dialog content
 * on close, which drops whatever was typed but not submitted.
 */
export function PasswordModal({
  open,
  settingKey,
  onUnlock,
  onClose,
}: {
  open: boolean;
  settingKey: string;
  onUnlock: UnlockHandler;
  onClose: () => void;
}) {
  const [pending, setPending] = useState(false);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        // Closing mid-request would orphan a reveal whose result the field
        // still applies; the request is short, so the modal waits for it.
        if (!next && !pending) onClose();
      }}
    >
      <DialogContent showCloseButton={!pending}>
        {/* Title and description deliberately avoid the words "password" and
            the setting's label: the dialog is labelled by its title, and a
            second element matching the field's label would be ambiguous to
            assistive tech. */}
        <DialogHeader>
          <DialogTitle>Confirm it&apos;s you</DialogTitle>
          <DialogDescription>
            Unlocking <span className="font-mono">{settingKey}</span> shows its value and lets you
            change it. Wrong attempts count toward your account lockout.
          </DialogDescription>
        </DialogHeader>
        <PasswordForm
          onUnlock={onUnlock}
          onCancel={onClose}
          pending={pending}
          setPending={setPending}
        />
      </DialogContent>
    </Dialog>
  );
}

function PasswordForm({
  onUnlock,
  onCancel,
  pending,
  setPending,
}: {
  onUnlock: UnlockHandler;
  onCancel: () => void;
  pending: boolean;
  setPending: (pending: boolean) => void;
}) {
  const inputId = useId();
  const errorId = useId();
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  // A boolean, never the password.
  const inFlight = useRef(false);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    // A second submit while one is in flight would spend a second lockout
    // attempt; the disabled button covers clicks, this covers Enter.
    // The ref catches two submits inside one render, before `pending` lands.
    if (inFlight.current || pending || password === '') return;
    inFlight.current = true;

    const attempt = password;
    // Cleared before the request even starts: from here the password exists
    // only in this function's frame and the in-flight request body.
    setPassword('');
    setError(null);
    setPending(true);
    try {
      const message = await onUnlock(attempt);
      if (message !== null) setError(message);
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4" autoComplete="on">
      <div className="flex flex-col gap-1.5">
        <label htmlFor={inputId} className="text-sm font-medium text-text">
          Password
        </label>
        <Input
          id={inputId}
          name="current-password"
          type="password"
          autoComplete="current-password"
          autoFocus
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            setError(null);
          }}
          disabled={pending}
          aria-invalid={error !== null}
          aria-describedby={error ? errorId : undefined}
          className={error ? 'border-error' : undefined}
        />
        {error && (
          <p id={errorId} role="alert" className="text-sm text-error">
            {error}
          </p>
        )}
      </div>
      <DialogFooter>
        <Button type="button" variant="secondary" onClick={onCancel} disabled={pending}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" disabled={pending || password === ''}>
          {pending ? 'Unlocking…' : 'Unlock'}
        </Button>
      </DialogFooter>
    </form>
  );
}
