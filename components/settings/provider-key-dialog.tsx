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

const MIN_LENGTH = 8;
const MAX_LENGTH = 512;

/**
 * The typed key lives in KeyForm's state, and KeyForm lives inside
 * DialogContent, which unmounts on close. Closing the dialog, saved or not,
 * therefore drops the key: no effect, and nothing to forget to clear.
 */
function KeyForm({
  providerLabel,
  replacing,
  pending,
  error,
  onSave,
  onClose,
}: {
  providerLabel: string;
  replacing: boolean;
  pending: boolean;
  error: string | null;
  onSave: (apiKey: string) => void;
  onClose: () => void;
}) {
  const [value, setValue] = useState('');
  const trimmed = value.trim();
  const valid = trimmed.length >= MIN_LENGTH && trimmed.length <= MAX_LENGTH;

  return (
    <form
      className="grid gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (valid && !pending) onSave(trimmed);
      }}
    >
      <DialogHeader>
        <DialogTitle>{replacing ? `Replace ${providerLabel} key` : `Add ${providerLabel} key`}</DialogTitle>
        <DialogDescription>
          {replacing
            ? 'The new key replaces the saved one. Saved keys are never shown.'
            : 'Paste the API key from your provider dashboard. It is stored encrypted and never shown again.'}
        </DialogDescription>
      </DialogHeader>

      <label className="grid gap-2 text-sm">
        <span className="text-muted">API key</span>
        <Input
          type="password"
          // Browsers ignore "off" on password fields; "new-password" (plus the
          // password-manager opt-outs) keeps the saved login password out.
          autoComplete="new-password"
          data-1p-ignore
          data-lpignore="true"
          spellCheck={false}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          aria-invalid={error ? true : undefined}
        />
      </label>

      {error ? (
        <p role="alert" className="text-sm text-error">
          {error}
        </p>
      ) : null}

      <DialogFooter>
        <Button type="button" variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" disabled={!valid || pending}>
          {pending ? 'Saving…' : 'Save key'}
        </Button>
      </DialogFooter>
    </form>
  );
}

export function ProviderKeyDialog({
  open,
  onClose,
  ...form
}: {
  open: boolean;
  providerLabel: string;
  replacing: boolean;
  pending: boolean;
  error: string | null;
  onSave: (apiKey: string) => void;
  onClose: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent>
        <KeyForm {...form} onClose={onClose} />
      </DialogContent>
    </Dialog>
  );
}
