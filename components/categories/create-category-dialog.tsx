'use client';

import { useId, useState } from 'react';
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
 * Used for both "New category" (parentId undefined) and a row's "Add child"
 * (parentId set to that row's id). There is deliberately no kind selector:
 * the tree is kind-scoped (spec §6.4 — "a parent of a different kind is not
 * offered"), and a child always inherits the parent's kind, so `kind` is
 * fixed by the caller rather than chosen here.
 */
export function CreateCategoryDialog({
  open,
  onOpenChange,
  parentName,
  fieldErrors,
  pending,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  parentName?: string;
  fieldErrors?: Record<string, string[]>;
  pending?: boolean;
  onSubmit: (name: string) => void;
}) {
  const [name, setName] = useState('');
  const nameId = useId();

  // Reset the draft name whenever the dialog transitions closed -> open,
  // without an effect (React's "adjust state during render" pattern —
  // https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes
  // — matches assets-page-content.tsx's filterKey reset).
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setName('');
  }

  const nameError = fieldErrors?.name?.[0];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{parentName ? `Add child under "${parentName}"` : 'New category'}</DialogTitle>
          <DialogDescription>
            {parentName
              ? 'The new category inherits the same kind as its parent.'
              : 'Give the category a name. You can add children and reorder it afterward.'}
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-1.5">
          <label htmlFor={nameId} className="text-sm font-medium text-text">
            Name
          </label>
          <Input
            id={nameId}
            value={name}
            onChange={(e) => setName(e.target.value)}
            aria-invalid={Boolean(nameError)}
            autoFocus
          />
          {nameError && <p className="text-sm text-error">{nameError}</p>}
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="primary"
            disabled={pending || name.trim().length === 0}
            onClick={() => onSubmit(name.trim())}
          >
            {pending ? 'Creating…' : 'Create'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
