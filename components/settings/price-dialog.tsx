'use client';

import { useState } from 'react';
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
import { Switch } from '@/components/ui/switch';
import { ApiError } from '@/lib/api/client';
import { activatePricingRule, createPricingRule } from '@/lib/api/credits';
import { cn } from '@/lib/cn';
import { toast } from '@/lib/use-toast';
import {
  describeLength,
  draftProblems,
  MAX_TIERS,
  previewPrices,
  toNewRule,
  type PriceDraft,
} from './pricing-format';

const EMPTY_DRAFT: PriceDraft = {
  mode: 'duration_tiers',
  perJob: '',
  rows: [{ upTo: '', credits: '' }],
  longer: '',
  blockSeconds: '',
  blockCredits: '',
  minCredits: '',
  note: '',
};

const MODE_LABELS = {
  duration_tiers: 'By length',
  per_second: 'By the second',
  per_job: 'Per job',
} as const;

/** The server's own sentences when it still refuses (`details.problems`), else its message. */
function serverProblems(error: unknown): string[] {
  if (!(error instanceof ApiError) || error.status !== 422) return [];
  const problems = (error.details as { problems?: unknown } | undefined)?.problems;
  return Array.isArray(problems) && problems.every((p) => typeof p === 'string') ? problems : [error.message];
}

function seconds(raw: string): number | null {
  const text = raw.trim();
  return /^\d+$/.test(text) ? Number(text) : null;
}

/** Lives inside DialogContent, so closing drops the draft. */
function PriceForm({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<PriceDraft>(EMPTY_DRAFT);
  const [touched, setTouched] = useState(false);
  const [activateNow, setActivateNow] = useState(true);

  const mutation = useMutation({
    mutationFn: async (vars: { draft: PriceDraft; activate: boolean }) => {
      const created = await createPricingRule(toNewRule(vars.draft));
      if (vars.activate) await activatePricingRule(created.id);
      return { version: created.version, activated: vars.activate };
    },
    onSuccess: async ({ version, activated }) => {
      toast(activated ? `Price v${version} is active` : `Price v${version} saved`);
      onClose();
      await queryClient.invalidateQueries({ queryKey: ['pricing'] });
    },
    onError: async (error) => {
      // The version may exist even if activating it failed: show it either way.
      await queryClient.invalidateQueries({ queryKey: ['pricing'] });
      if (error instanceof ApiError && (error.status === 422 || error.status === 401)) return;
      toast(error instanceof Error ? error.message : 'Something went wrong.', 'error');
      if (error instanceof ApiError) console.error(`API error traceId: ${error.traceId}`);
    },
  });

  const update = (patch: Partial<PriceDraft>) => {
    setTouched(true);
    setDraft((prev) => ({ ...prev, ...patch }));
  };
  const setRow = (index: number, patch: Partial<PriceDraft['rows'][number]>) =>
    update({ rows: draft.rows.map((row, i) => (i === index ? { ...row, ...patch } : row)) });

  const problems = draftProblems(draft);
  const refused = serverProblems(mutation.error);
  const canSubmit = problems.length === 0 && !mutation.isPending;

  return (
    <form
      className="grid gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (canSubmit) mutation.mutate({ draft, activate: activateNow });
      }}
    >
      <DialogHeader>
        <DialogTitle>New caption price</DialogTitle>
        <DialogDescription>
          Prices are never edited: this creates a new version. Lengths are in seconds and include their upper
          bound.
        </DialogDescription>
      </DialogHeader>

      <div className="grid grid-cols-3 gap-2" role="group" aria-label="How to charge">
        {(['duration_tiers', 'per_second', 'per_job'] as const).map((mode) => (
          <Button
            key={mode}
            type="button"
            variant="secondary"
            aria-pressed={draft.mode === mode}
            onClick={() => update({ mode })}
            className={cn('px-2', draft.mode === mode && 'border-text text-text')}
          >
            {MODE_LABELS[mode]}
          </Button>
        ))}
      </div>

      {draft.mode === 'per_job' ? (
        <label className="grid gap-2 text-sm">
          <span className="text-muted">Credits per job</span>
          <Input inputMode="numeric" value={draft.perJob} onChange={(e) => update({ perJob: e.target.value })} />
        </label>
      ) : draft.mode === 'per_second' ? (
        <div className="grid gap-3">
          <p className="text-sm text-muted">
            Every started block costs its credits in full. The audio&apos;s length is measured to the millisecond.
          </p>
          <div className="grid grid-cols-[1fr_auto_1fr_auto] items-center gap-2">
            <Input
              aria-label="Credits per block"
              inputMode="numeric"
              placeholder="Credits"
              value={draft.blockCredits}
              onChange={(e) => update({ blockCredits: e.target.value })}
            />
            <span className="text-sm text-muted">per</span>
            <Input
              aria-label="Block length in seconds"
              inputMode="numeric"
              placeholder="Seconds"
              value={draft.blockSeconds}
              onChange={(e) => update({ blockSeconds: e.target.value })}
            />
            <span className="text-sm text-muted">s</span>
          </div>
          <label className="grid gap-2 text-sm">
            <span className="text-muted">Minimum per job (optional)</span>
            <Input
              inputMode="numeric"
              placeholder="No minimum"
              value={draft.minCredits}
              onChange={(e) => update({ minCredits: e.target.value })}
            />
          </label>
          {previewPrices(draft) ? (
            <p data-testid="price-preview" className="text-sm text-text">
              {previewPrices(draft)}
            </p>
          ) : null}
        </div>
      ) : (
        <div className="grid gap-3">
          {draft.rows.map((row, i) => {
            const s = seconds(row.upTo);
            return (
              <div key={i} className="grid grid-cols-[1fr_auto_1fr_auto] items-start gap-2">
                <div className="grid gap-1">
                  <Input
                    aria-label={`Tier ${i + 1} seconds`}
                    inputMode="numeric"
                    placeholder="Up to (s)"
                    value={row.upTo}
                    onChange={(e) => setRow(i, { upTo: e.target.value })}
                  />
                  {s !== null && s >= 60 ? (
                    <span className="text-xs text-subtle">{`${s} s = ${describeLength(s)}`}</span>
                  ) : null}
                </div>
                <span className="pt-2.5 text-muted" aria-hidden="true">
                  →
                </span>
                <Input
                  aria-label={`Tier ${i + 1} credits`}
                  inputMode="numeric"
                  placeholder="Credits"
                  value={row.credits}
                  onChange={(e) => setRow(i, { credits: e.target.value })}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  aria-label={`Remove tier ${i + 1}`}
                  onClick={() => update({ rows: draft.rows.filter((_, j) => j !== i) })}
                >
                  <X size={16} />
                </Button>
              </div>
            );
          })}

          <div className="grid grid-cols-[1fr_auto_1fr_auto] items-center gap-2">
            <span className="text-sm text-muted">Anything longer</span>
            <span className="text-muted" aria-hidden="true">
              →
            </span>
            <Input
              aria-label="Anything longer credits"
              inputMode="numeric"
              placeholder="Credits"
              value={draft.longer}
              onChange={(e) => update({ longer: e.target.value })}
            />
            <span className="w-9" />
          </div>

          <div>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={draft.rows.length + 1 >= MAX_TIERS}
              onClick={() => update({ rows: [...draft.rows, { upTo: '', credits: '' }] })}
            >
              Add tier
            </Button>
          </div>
        </div>
      )}

      <label className="grid gap-2 text-sm">
        <span className="text-muted">Note (optional)</span>
        <Input maxLength={500} value={draft.note} onChange={(e) => update({ note: e.target.value })} />
      </label>

      <label className="flex items-center gap-3 text-sm text-text">
        <Switch checked={activateNow} onCheckedChange={setActivateNow} aria-label="Activate now" />
        Activate now
      </label>

      {touched && problems.length > 0 ? (
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

      <DialogFooter>
        <Button type="button" variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" disabled={!canSubmit}>
          {mutation.isPending ? 'Saving…' : 'Create price'}
        </Button>
      </DialogFooter>
    </form>
  );
}

export function PriceDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <PriceForm onClose={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}
