'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ApiError } from '@/lib/api/client';
import {
  fetchCreditSettings,
  updateCreditSettings,
  type CreditSettings,
  type CreditSettingsPatch,
} from '@/lib/api/credits';
import { fieldErrors, validationSummary } from '@/lib/api/field-errors';
import { cn } from '@/lib/cn';
import { toast } from '@/lib/use-toast';
import { formatDateTime } from '@/components/users/format';
import { BalanceCheck } from './balance-check';
import {
  CREDIT_FIELD_GROUPS,
  changedFields,
  normalizeDomains,
  parseField,
  toFormValues,
  type FormValues,
} from './credit-settings-form';

const SETTINGS_KEY = ['credits', 'settings'] as const;
const NUMBER = new Intl.NumberFormat('en-GB');

/**
 * Keyed on updatedAt by its parent, so a save (which returns the new row)
 * remounts it with fresh values instead of syncing state in an effect.
 */
function CreditsForm({ settings }: { settings: CreditSettings }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<FormValues>(() => toFormValues(settings));
  const mutation = useMutation({
    mutationFn: (patch: CreditSettingsPatch) => updateCreditSettings(patch),
    onSuccess: (saved) => {
      toast('Credit settings saved. The app uses them within 30 seconds.');
      queryClient.setQueryData(SETTINGS_KEY, saved);
    },
    onError: (error) => {
      if (error instanceof ApiError && (error.status === 422 || error.status === 401)) return;
      toast(error instanceof Error ? error.message : 'Something went wrong.', 'error');
      if (error instanceof ApiError) console.error(`API error traceId: ${error.traceId}`);
    },
  });

  const patch = changedFields(settings, form);
  const invalid = CREDIT_FIELD_GROUPS.some((g) => g.fields.some((f) => parseField(f, form[f.key]) === null));
  const serverErrors = fieldErrors(mutation.error);
  const unmapped =
    mutation.error instanceof ApiError &&
    mutation.error.status === 422 &&
    Object.keys(serverErrors).length === 0
      ? validationSummary(mutation.error)
      : null;
  const domainCount = normalizeDomains(form.domains).length;
  const canSave = Object.keys(patch).length > 0 && !invalid && !mutation.isPending;

  const set = (key: keyof FormValues, value: string) => setForm((prev) => ({ ...prev, [key]: value }));

  return (
    <form
      className="flex flex-col gap-6"
      onSubmit={(e) => {
        e.preventDefault();
        if (canSave) mutation.mutate(patch);
      }}
    >
      {CREDIT_FIELD_GROUPS.map((group) => (
        <section key={group.title} className="rounded-xl border border-border bg-surface p-4 md:p-6">
          <h3 className="mb-4 text-sm font-semibold text-text">{group.title}</h3>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {group.fields.map((field) => {
              const outOfRange = parseField(field, form[field.key]) === null;
              const message = outOfRange
                ? `A whole number from ${NUMBER.format(field.min)} to ${NUMBER.format(field.max)}`
                : serverErrors[field.key];
              return (
                <label key={field.key} className="grid gap-2 text-sm">
                  <span className="text-muted">{field.label}</span>
                  <Input
                    type="number"
                    inputMode="numeric"
                    min={field.min}
                    max={field.max}
                    step={1}
                    value={form[field.key]}
                    onChange={(e) => set(field.key, e.target.value)}
                    aria-invalid={message ? true : undefined}
                  />
                  {message ? <span className="text-xs text-error">{message}</span> : null}
                </label>
              );
            })}
          </div>
        </section>
      ))}

      <section className="rounded-xl border border-border bg-surface p-4 md:p-6">
        <h3 className="mb-1 text-sm font-semibold text-text">Disposable email domains</h3>
        <label className="grid gap-2 text-sm">
          <span className="text-muted">Email sign-in is refused for these domains. One per line.</span>
          <textarea
            rows={8}
            spellCheck={false}
            value={form.domains}
            onChange={(e) => set('domains', e.target.value)}
            className={cn(
              'w-full rounded-lg border border-border bg-elevated px-3 py-2 font-mono text-sm text-text',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-from)]',
            )}
          />
          <span className="text-xs text-subtle">
            {`${NUMBER.format(domainCount)} ${domainCount === 1 ? 'domain' : 'domains'}`}
          </span>
          {serverErrors.disposableEmailDomains ? (
            <span className="text-xs text-error">{serverErrors.disposableEmailDomains}</span>
          ) : null}
        </label>
      </section>

      {unmapped ? (
        <p role="alert" className="text-sm text-error">
          {unmapped}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-subtle">{`Last changed ${formatDateTime(settings.updatedAt)}`}</p>
        <Button type="submit" variant="primary" disabled={!canSave}>
          {mutation.isPending ? 'Saving…' : 'Save'}
        </Button>
      </div>
    </form>
  );
}

export function CreditsTab() {
  const query = useQuery({ queryKey: SETTINGS_KEY, queryFn: fetchCreditSettings });

  return (
    <div className="flex flex-col gap-6">
      {query.data ? (
        <CreditsForm key={query.data.updatedAt} settings={query.data} />
      ) : query.isError ? (
        <p className="text-sm text-error">Could not load the credit settings. Reload the page to try again.</p>
      ) : (
        <p className="text-sm text-subtle">Loading…</p>
      )}
      <BalanceCheck />
    </div>
  );
}
