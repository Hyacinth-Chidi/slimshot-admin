'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { X } from 'lucide-react';
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
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import {
  describePrice,
  draftProblems,
  draftToRule,
  MAX_TIERS,
  ruleToDraft,
  toNewRule,
  type PriceDraft,
} from '@/components/settings/pricing-format';
import { ApiError } from '@/lib/api/client';
import { activatePricingRule, createPricingRule, type PricingMode, type PricingRule } from '@/lib/api/credits';
import { cn } from '@/lib/cn';
import { toast } from '@/lib/use-toast';
import { CostComparison } from './cost-comparison';

const MODES: Array<{ mode: PricingMode; title: string; explain: string }> = [
  { mode: 'per_second', title: 'By time used', explain: 'A price for every block of seconds started.' },
  { mode: 'duration_tiers', title: 'By length band', explain: 'A set price for clips up to a length.' },
  { mode: 'per_job', title: 'Flat per job', explain: 'The same price for any clip.' },
];

/** Edited inputs are marked with the brand colour as a border, never the gradient. */
const EDITED = 'border-[var(--brand-from)]';

/** The server's own sentences when it still refuses (`details.problems`), else its message. */
function serverProblems(error: unknown): string[] {
  if (!(error instanceof ApiError) || error.status !== 422) return [];
  const problems = (error.details as { problems?: unknown } | undefined)?.problems;
  return Array.isArray(problems) && problems.every((p) => typeof p === 'string') ? problems : [error.message];
}

interface SheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The price in force now: what the draft is compared against. */
  live: PricingRule | null;
  /** A history version to start from instead of the live price. */
  startFrom: PricingRule | null;
  nextVersion: number;
  adRewardCredits: number | null;
}

/**
 * Change the Auto captions price in a side panel. It starts from the live
 * price (or a chosen version), compares every change against what is live
 * now, and only makes the new version live after a confirm.
 */
export function ChangePriceSheet(props: SheetProps) {
  const { open, onOpenChange } = props;
  const [dirty, setDirty] = useState(false);
  const [askDiscard, setAskDiscard] = useState(false);

  const close = () => {
    setDirty(false);
    setAskDiscard(false);
    onOpenChange(false);
  };
  // Escape, the X, the overlay and Cancel all come here: unsaved edits are never dropped silently.
  const requestClose = () => (dirty ? setAskDiscard(true) : close());

  // A reload or closing the tab asks too, while a price is half-made.
  useEffect(() => {
    if (!open || !dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [open, dirty]);

  return (
    <>
      <Sheet open={open} onOpenChange={(next) => (next ? onOpenChange(true) : requestClose())}>
        {/* data-[side=right]:w-full, not w-full: the base sheet's data-[side=right]:w-3/4 outranks a plain class. */}
        <SheetContent side="right" className="gap-0 p-0 data-[side=right]:w-full data-[side=right]:sm:max-w-[560px]">
          {open && <PriceForm {...props} onEdit={() => setDirty(true)} onCancel={requestClose} onDone={close} />}
        </SheetContent>
      </Sheet>

      <Dialog open={askDiscard} onOpenChange={setAskDiscard}>
        <DialogContent role="alertdialog" showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Discard this price?</DialogTitle>
            <DialogDescription>Your changes to the price will be lost.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => setAskDiscard(false)}>
              Keep editing
            </Button>
            <Button type="button" variant="danger" onClick={close}>
              Discard
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function PriceForm({
  live,
  startFrom,
  nextVersion,
  adRewardCredits,
  onEdit,
  onCancel,
  onDone,
}: SheetProps & { onEdit: () => void; onCancel: () => void; onDone: () => void }) {
  const queryClient = useQueryClient();
  const start = startFrom ?? live;
  const [initial] = useState<PriceDraft>(() => ruleToDraft(start));
  const [draft, setDraft] = useState<PriceDraft>(initial);
  const [confirming, setConfirming] = useState(false);

  const mutation = useMutation({
    mutationFn: async (vars: { activate: boolean }) => {
      const created = await createPricingRule(toNewRule(draft));
      if (vars.activate) await activatePricingRule(created.id);
      return { version: created.version, activated: vars.activate };
    },
    onSuccess: async ({ version, activated }) => {
      toast(activated ? `Price v${version} is live` : `Price v${version} saved for later`);
      await queryClient.invalidateQueries({ queryKey: ['pricing'] });
      onDone();
    },
    onError: async (error) => {
      setConfirming(false);
      // The version may exist even if making it live failed: show it either way.
      await queryClient.invalidateQueries({ queryKey: ['pricing'] });
      if (error instanceof ApiError && (error.status === 422 || error.status === 401)) return;
      toast(error instanceof Error ? error.message : 'Something went wrong.', 'error');
    },
  });

  const update = (patch: Partial<PriceDraft>) => {
    onEdit();
    setDraft((prev) => ({ ...prev, ...patch }));
  };
  const setRow = (index: number, patch: Partial<PriceDraft['rows'][number]>) =>
    update({ rows: draft.rows.map((row, i) => (i === index ? { ...row, ...patch } : row)) });

  const next = draftToRule(draft);
  const problems = draftProblems(draft);
  const refused = serverProblems(mutation.error);
  const canSave = next !== null && !mutation.isPending;
  const edited = (key: keyof PriceDraft) => draft[key] !== initial[key] && EDITED;

  const subtitle = !start
    ? `Saving creates v${nextVersion}.`
    : startFrom
      ? `Filled in from v${startFrom.version}. Saving creates v${nextVersion}; past charges never change.`
      : `Filled in with the live price (v${start.version}). Saving creates v${nextVersion}; past charges never change.`;

  const inline = 'mx-1 inline-block h-11 w-20 text-center align-middle font-semibold tabular-nums md:h-9';

  return (
    <div className="flex h-full flex-col">
      <SheetHeader className="border-b border-border px-6 pt-5 pb-4 pr-14">
        <SheetTitle className="text-lg font-semibold">
          {live ? 'Change the Auto captions price' : 'Set the Auto captions price'}
        </SheetTitle>
        <SheetDescription>{subtitle}</SheetDescription>
      </SheetHeader>

      <div className="flex flex-1 flex-col gap-6 overflow-y-auto px-6 py-5">
        <fieldset>
          <legend className="mb-2 text-xs text-subtle">How to charge</legend>
          <div className="grid gap-2 sm:grid-cols-3">
            {MODES.map(({ mode, title, explain }) => (
              <button
                key={mode}
                type="button"
                aria-pressed={draft.mode === mode}
                onClick={() => update({ mode })}
                className={cn(
                  'rounded-xl border border-border bg-elevated p-3 text-left transition-colors duration-150 ease-out',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-from)]',
                  draft.mode === mode && 'border-[var(--brand-from)] bg-[var(--brand-from)]/10',
                )}
              >
                <span className="block text-sm font-semibold text-text">{title}</span>
                <span className="mt-0.5 block text-xs leading-snug text-muted">{explain}</span>
              </button>
            ))}
          </div>
        </fieldset>

        {draft.mode === 'per_second' ? (
          <p className="text-[15px] leading-[3] text-text">
            Charge
            <Input
              aria-label="Credits per block"
              inputMode="numeric"
              className={cn(inline, edited('blockCredits'))}
              value={draft.blockCredits}
              onChange={(e) => update({ blockCredits: e.target.value })}
            />
            credits for every
            <Input
              aria-label="Block length in seconds"
              inputMode="numeric"
              className={cn(inline, edited('blockSeconds'))}
              value={draft.blockSeconds}
              onChange={(e) => update({ blockSeconds: e.target.value })}
            />
            seconds started, and never less than
            <Input
              aria-label="Minimum credits per job"
              inputMode="numeric"
              placeholder="0"
              className={cn(inline, edited('minCredits'))}
              value={draft.minCredits}
              onChange={(e) => update({ minCredits: e.target.value })}
            />
            credits a job.
          </p>
        ) : draft.mode === 'per_job' ? (
          <p className="text-[15px] leading-[3] text-text">
            Charge
            <Input
              aria-label="Credits per clip"
              inputMode="numeric"
              className={cn(inline, edited('perJob'))}
              value={draft.perJob}
              onChange={(e) => update({ perJob: e.target.value })}
            />
            credits for every clip.
          </p>
        ) : (
          <div className="flex flex-col gap-2 text-[15px] text-text">
            {draft.rows.map((row, i) => (
              <div key={i} className="flex items-center gap-1">
                <span>Up to</span>
                <Input
                  aria-label={`Band ${i + 1} up to seconds`}
                  inputMode="numeric"
                  className={cn(inline, row.upTo !== initial.rows[i]?.upTo && EDITED)}
                  value={row.upTo}
                  onChange={(e) => setRow(i, { upTo: e.target.value })}
                />
                <span>seconds →</span>
                <Input
                  aria-label={`Band ${i + 1} credits`}
                  inputMode="numeric"
                  className={cn(inline, row.credits !== initial.rows[i]?.credits && EDITED)}
                  value={row.credits}
                  onChange={(e) => setRow(i, { credits: e.target.value })}
                />
                <span>credits</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  aria-label={`Remove band ${i + 1}`}
                  className="ml-auto"
                  onClick={() => update({ rows: draft.rows.filter((_, j) => j !== i) })}
                >
                  <X size={16} />
                </Button>
              </div>
            ))}
            <div className="flex items-center gap-1">
              <span>Anything longer →</span>
              <Input
                aria-label="Anything longer credits"
                inputMode="numeric"
                className={cn(inline, edited('longer'))}
                value={draft.longer}
                onChange={(e) => update({ longer: e.target.value })}
              />
              <span>credits</span>
            </div>
            <div>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={draft.rows.length + 1 >= MAX_TIERS}
                onClick={() => update({ rows: [...draft.rows, { upTo: '', credits: '' }] })}
              >
                Add band
              </Button>
            </div>
          </div>
        )}

        {problems.length > 0 ? (
          <ul role="alert" className="list-disc space-y-1 pl-5 text-sm text-error">
            {problems.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        ) : refused.length > 0 ? (
          <ul role="alert" className="list-disc space-y-1 pl-5 text-sm text-error">
            {refused.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        ) : null}

        <CostComparison
          now={live}
          nowLabel={live ? `Now (v${live.version})` : 'Now'}
          next={next}
          nextLabel={`New (v${nextVersion})`}
          adRewardCredits={adRewardCredits}
        />

        <label className="grid gap-2 text-sm">
          <span className="text-muted">Reason (shown in the price history)</span>
          <Input
            maxLength={500}
            placeholder="e.g. Provider costs went up"
            value={draft.note}
            onChange={(e) => update({ note: e.target.value })}
          />
        </label>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border px-6 py-4">
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="button" variant="secondary" disabled={!canSave} onClick={() => mutation.mutate({ activate: false })}>
          Save for later
        </Button>
        <Button type="button" variant="primary" disabled={!canSave} onClick={() => setConfirming(true)}>
          {`Make v${nextVersion} live…`}
        </Button>
      </div>

      <Dialog open={confirming} onOpenChange={(o) => !mutation.isPending && setConfirming(o)}>
        <DialogContent role="alertdialog" showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>{`Make v${nextVersion} live?`}</DialogTitle>
            <DialogDescription>
              {next ? `New caption jobs will cost ${describePrice(next)}. Jobs already charged keep their price.` : ''}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="secondary" disabled={mutation.isPending} onClick={() => setConfirming(false)}>
              Cancel
            </Button>
            <Button type="button" variant="primary" disabled={mutation.isPending} onClick={() => mutation.mutate({ activate: true })}>
              {mutation.isPending ? 'Saving…' : 'Make live'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
