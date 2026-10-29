'use client';

import { Fragment, useEffect, useId, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { RuleLike } from '@/components/settings/pricing-format';
import type { NumericSettingKey } from '@/components/settings/credit-settings-form';
import { ApiError } from '@/lib/api/client';
import { updateCreditSettings, type CreditSettings, type CreditSettingsPatch } from '@/lib/api/credits';
import { fieldErrors } from '@/lib/api/field-errors';
import { cn } from '@/lib/cn';
import { formatShortDate } from '@/lib/format';
import { toast } from '@/lib/use-toast';
import type { SentencePart, SettingCardSpec } from './setting-cards';

type Field = Exclude<SentencePart, string>;

const NUMBER = new Intl.NumberFormat('en-GB');

function fieldsOf(spec: SettingCardSpec): Field[] {
  return spec.sentences.flat().filter((part): part is Field => typeof part !== 'string');
}

/** A whole number within the field's bounds, or null. */
function parse(field: Field, raw: string): number | null {
  const text = raw.trim();
  if (!/^\d+$/.test(text)) return null;
  const value = Number(text);
  return value >= field.min && value <= field.max ? value : null;
}

/** "Changed 27 Oct by owner@slimshot.dev" from the newest change among the card's fields. */
function changedLine(settings: CreditSettings, keys: NumericSettingKey[]): string | null {
  if (!settings.lastChanged) return null;
  const newest = keys
    .map((key) => settings.lastChanged?.[key])
    .filter((c): c is NonNullable<typeof c> => Boolean(c))
    .sort((a, b) => b.at.localeCompare(a.at))[0];
  if (!newest) return 'Never changed';
  return newest.by ? `Changed ${formatShortDate(newest.at)} by ${newest.by.email}` : `Changed ${formatShortDate(newest.at)}`;
}

/**
 * One group of credit settings written as sentences, with the numbers as
 * inputs. It saves only its own fields, and only those that changed, so two
 * cards edited at once never overwrite each other. Its edits are kept apart
 * from the saved settings, so a save from another card doesn't wipe them.
 */
export function SettingCard({ spec, settings, live }: { spec: SettingCardSpec; settings: CreditSettings; live: RuleLike | null }) {
  const queryClient = useQueryClient();
  const headingId = useId();
  const fields = fieldsOf(spec);
  // Only what has been typed; anything untouched follows the saved settings.
  const [edits, setEdits] = useState<Partial<Record<NumericSettingKey, string>>>({});

  const shown = (field: Field) => edits[field.key] ?? String(settings[field.key]);
  const changed = fields.filter((f) => edits[f.key] !== undefined && edits[f.key] !== String(settings[f.key]));
  const dirty = changed.length > 0;
  const invalid = fields.filter((f) => parse(f, shown(f)) === null);

  const mutation = useMutation({
    mutationFn: (patch: CreditSettingsPatch) => updateCreditSettings(patch),
    onSuccess: (saved) => {
      setEdits({});
      queryClient.setQueryData(['credits', 'settings'], saved);
      toast('Saved. The app uses the new values within 30 seconds.');
    },
    onError: (error) => {
      if (error instanceof ApiError && (error.status === 422 || error.status === 401)) return;
      toast(error instanceof Error ? error.message : 'Something went wrong.', 'error');
    },
  });
  const refused = fieldErrors(mutation.error);

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

  const save = () => {
    const patch: CreditSettingsPatch = {};
    for (const field of changed) {
      const value = parse(field, shown(field));
      if (value !== null) patch[field.key] = value;
    }
    mutation.mutate(patch);
  };

  const values = Object.fromEntries(
    fields.flatMap((f) => {
      const value = parse(f, shown(f));
      return value === null ? [] : [[f.key, value]];
    }),
  ) as Partial<Record<NumericSettingKey, number>>;
  const hint = spec.hint?.({ values, live }) ?? null;
  const Icon = spec.icon;
  const errors = [
    ...invalid.map((f) => ({ key: f.key, text: `A whole number from ${NUMBER.format(f.min)} to ${NUMBER.format(f.max)}.` })),
    ...fields.filter((f) => refused[f.key] && !invalid.includes(f)).map((f) => ({ key: f.key, text: refused[f.key] })),
  ];

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
          <Icon size={16} aria-hidden="true" />
          {spec.title}
        </h2>
        {dirty && (
          <span className="rounded-full border border-warning/30 bg-warning/10 px-2 py-0.5 text-xs font-medium text-warning">
            Unsaved
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-1 px-5 py-4">
        {spec.sentences.map((sentence, i) => (
          <Fragment key={i}>
            <p className="text-[15px] leading-[2.6] text-text">
              {sentence.map((part, j) =>
                typeof part === 'string' ? (
                  <Fragment key={j}>{j === 0 ? part : ` ${part}`}</Fragment>
                ) : (
                  <Fragment key={part.key}>
                    {' '}
                    <Input
                      aria-label={part.label}
                      aria-invalid={errors.some((e) => e.key === part.key) || undefined}
                      inputMode="numeric"
                      value={shown(part)}
                      onChange={(e) => setEdits((prev) => ({ ...prev, [part.key]: e.target.value }))}
                      className={cn(
                        'inline-block h-11 w-20 text-center align-middle font-semibold tabular-nums md:h-9',
                        changed.includes(part) && 'border-[var(--brand-from)]',
                        errors.some((e) => e.key === part.key) && 'border-error',
                      )}
                    />
                  </Fragment>
                ),
              )}
            </p>
            {i === 0 && hint && <p className="-mt-1 mb-1 text-xs text-subtle">{hint}</p>}
          </Fragment>
        ))}
        {errors.length > 0 && (
          <ul role="alert" className="mt-1 space-y-1 text-sm text-error">
            {errors.map((e) => (
              <li key={e.key}>{e.text}</li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex min-h-14 items-center justify-between gap-3 border-t border-border px-5 py-3 text-xs text-subtle">
        {dirty ? (
          <Button variant="ghost" size="sm" onClick={() => setEdits({})} disabled={mutation.isPending}>
            Undo
          </Button>
        ) : (
          <span>{changedLine(settings, fields.map((f) => f.key))}</span>
        )}
        <Button
          variant={dirty ? 'primary' : 'secondary'}
          size="sm"
          disabled={!dirty || invalid.length > 0 || mutation.isPending}
          onClick={save}
        >
          {mutation.isPending ? 'Saving…' : 'Save'}
        </Button>
      </div>
    </section>
  );
}
