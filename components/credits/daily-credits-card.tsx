'use client';

import { useEffect, useId, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CalendarCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { ApiError } from '@/lib/api/client';
import {
  CREDIT_SETTINGS_KEY,
  CREDIT_SETTINGS_WRITES,
  updateCreditSettings,
  type CreditSettings,
  type CreditSettingsPatch,
} from '@/lib/api/credits';
import { cn } from '@/lib/cn';
import { toast } from '@/lib/use-toast';
import { changedLine } from './setting-card';

const MAX = 100_000;
const INVALID = 'Credits per day must be a whole number from 1 to 100,000.';

/** A whole number from 1 to 100,000, or null. */
function parseCredits(raw: string): number | null {
  const text = raw.trim();
  if (!/^\d+$/.test(text)) return null;
  const value = Number(text);
  return value >= 1 && value <= MAX ? value : null;
}

/**
 * Daily credits: whether users can claim them, and how many, once every 24 hours.
 * Built like the other Rewards cards: edits kept apart from the saved settings,
 * only what changed is sent, in the shared settings write queue.
 */
export function DailyCreditsCard({ settings }: { settings: CreditSettings }) {
  const queryClient = useQueryClient();
  const headingId = useId();
  const switchId = useId();
  const errorId = useId();
  const [edits, setEdits] = useState<{ enabled?: boolean; credits?: string }>({});

  const savedEnabled = settings.dailyRewardEnabled ?? false;
  const savedCredits = settings.dailyRewardCredits ?? 5;
  const enabled = edits.enabled ?? savedEnabled;
  const creditsText = edits.credits ?? String(savedCredits);
  const credits = parseCredits(creditsText);

  const patch: CreditSettingsPatch = {
    ...(enabled !== savedEnabled ? { dailyRewardEnabled: enabled } : {}),
    ...(credits !== null && credits !== savedCredits ? { dailyRewardCredits: credits } : {}),
  };
  const dirty = enabled !== savedEnabled || creditsText !== String(savedCredits);

  const mutation = useMutation({
    mutationFn: (changes: CreditSettingsPatch) => updateCreditSettings(changes),
    scope: CREDIT_SETTINGS_WRITES,
    onSuccess: async (saved) => {
      setEdits({});
      // A refetch still in flight would answer with the row from before this save.
      await queryClient.cancelQueries({ queryKey: CREDIT_SETTINGS_KEY });
      queryClient.setQueryData(CREDIT_SETTINGS_KEY, saved);
      toast('Saved. The app uses the new values within 30 seconds.');
    },
    onError: (error) => {
      if (error instanceof ApiError && error.status === 401) return;
      toast(error instanceof Error ? error.message : 'Something went wrong.', 'error');
    },
  });

  // Leaving the page with unsaved edits asks first.
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  // A server from before daily credits has nothing to set here.
  if (settings.dailyRewardEnabled === undefined) return null;

  return (
    <section
      aria-labelledby={headingId}
      className={cn(
        'flex flex-col rounded-xl border bg-surface transition-colors duration-150 ease-out',
        dirty ? 'border-[var(--brand-from)]/60' : 'border-border',
      )}
    >
      <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
        <h2 id={headingId} className="flex items-center gap-2 text-[15px] font-semibold text-text">
          <CalendarCheck size={16} aria-hidden="true" />
          Daily credits
        </h2>
        {dirty && (
          <span className="rounded-full border border-warning/30 bg-warning/10 px-2 py-0.5 text-xs font-medium text-warning">
            Unsaved
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-2 px-5 py-4">
        <div className="flex items-center justify-between gap-4">
          <label htmlFor={switchId} className="text-[15px] text-text">
            Give daily credits
          </label>
          <Switch
            id={switchId}
            checked={enabled}
            onCheckedChange={(checked) => setEdits((prev) => ({ ...prev, enabled: checked }))}
          />
        </div>
        <p className={cn('text-[15px] leading-[2.6]', enabled ? 'text-text' : 'text-subtle')}>
          Each user can claim{' '}
          <Input
            aria-label="Credits per day"
            aria-invalid={credits === null ? true : undefined}
            aria-describedby={credits === null ? errorId : undefined}
            inputMode="numeric"
            value={creditsText}
            onChange={(e) => setEdits((prev) => ({ ...prev, credits: e.target.value }))}
            className={cn(
              'inline-block h-11 w-20 text-center align-middle font-semibold tabular-nums md:h-9',
              creditsText !== String(savedCredits) && 'border-[var(--brand-from)]',
              credits === null && 'border-error',
            )}
          />{' '}
          credits once every 24 hours.
        </p>
        {credits === null && (
          <p id={errorId} className="-mt-1 text-sm text-error">
            {INVALID}
          </p>
        )}
      </div>

      <div className="flex min-h-14 items-center justify-between gap-3 border-t border-border px-5 py-3 text-xs text-subtle">
        {dirty ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setEdits({});
              mutation.reset();
            }}
            disabled={mutation.isPending}
          >
            Undo
          </Button>
        ) : (
          <span>{changedLine(settings, ['dailyRewardEnabled', 'dailyRewardCredits'])}</span>
        )}
        <Button
          variant={dirty ? 'primary' : 'secondary'}
          size="sm"
          disabled={!dirty || credits === null || mutation.isPending}
          onClick={() => mutation.mutate(patch)}
        >
          {mutation.isPending ? 'Saving…' : 'Save'}
        </Button>
      </div>
    </section>
  );
}
