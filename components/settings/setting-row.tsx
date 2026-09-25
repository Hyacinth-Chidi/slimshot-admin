'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/cn';
import { ApiError } from '@/lib/api/client';
import { fieldErrors } from '@/lib/api/field-errors';
import { toast } from '@/lib/use-toast';
import { updateSetting, type MaskedSetting } from '@/lib/api/settings';

/**
 * Humanizes a dotted setting key into a label only when no better label
 * exists — the key itself (e.g. `upload.ticketTtlSeconds`) is what the
 * server and the operator both call the field, so it stays as the
 * accessible name (aria-label / row heading) rather than being replaced.
 */
function describeKey(key: string): string {
  const last = key.split('.').pop() ?? key;
  return last.replace(/([a-z0-9])([A-Z])/g, '$1 $2').toLowerCase();
}

function parseDraft(type: MaskedSetting['type'], raw: string): unknown {
  if (type === 'int') {
    if (raw === '') return null;
    const parsed = Number(raw);
    if (Number.isNaN(parsed)) throw new Error('Enter a valid number.');
    return parsed;
  }
  if (type === 'string[]') {
    return raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }
  if (type === 'json') return JSON.parse(raw);
  return raw;
}

function draftToText(type: MaskedSetting['type'], value: unknown): string {
  if (value === null || value === undefined) return '';
  if (type === 'json') return JSON.stringify(value, null, 2);
  if (type === 'string[]') return Array.isArray(value) ? value.join(', ') : '';
  return String(value);
}

export function SettingRow({ setting }: { setting: MaskedSetting }) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState(() => draftToText(setting.type, setting.value));
  const [jsonError, setJsonError] = useState<string | null>(null);
  // R11d: a 422 on this row's own save is shown inline on this row rather
  // than toasted, whether or not the server sends a per-field `details`
  // breakdown — the server's setting-value 422 today carries no `details` at
  // all (a plain UnprocessableEntityException string), so falling back to
  // `fieldErrors` alone would silently drop the error into a toast for every
  // real validation failure. This is local state, not read off
  // mutation.error, so it survives past the mutation settling and is
  // cleared explicitly (on the next edit, or a subsequent successful save).
  const [saveError, setSaveError] = useState<string | null>(null);
  const initial = draftToText(setting.type, setting.value);

  const mutation = useMutation({
    mutationFn: (value: unknown) => updateSetting(setting.key, value),
    onSuccess: () => {
      setSaveError(null);
      queryClient.invalidateQueries({ queryKey: ['settings', setting.group] });
    },
    onError: (err) => {
      if (err instanceof ApiError && err.status === 422) {
        const errors = fieldErrors(err);
        // The server keys a setting-value 422 as `value` (see
        // ../slimshot_server/src/modules/admin/dto/update-setting.dto.ts:5),
        // not the setting's own key; either name resolves to this row's
        // field. When the server sends no `details` at all (the common case
        // today — see settings-admin.service.ts's plain
        // UnprocessableEntityException), fall back to the error's own
        // message so the row still shows something actionable instead of
        // silently losing the failure.
        setSaveError(errors[setting.key] ?? errors.value ?? err.message);
        return;
      }
      setSaveError(null);
      toast(err instanceof Error ? err.message : 'Failed to save setting.', 'error');
    },
  });

  function clearErrors() {
    setJsonError(null);
    setSaveError(null);
  }

  function saveIfChanged(nextDraft: string) {
    if (nextDraft === initial) return;

    let value: unknown;
    try {
      value = parseDraft(setting.type, nextDraft);
    } catch (err) {
      setJsonError(
        setting.type === 'int'
          ? 'Enter a valid number.'
          : err instanceof Error && err.message
            ? err.message
            : 'Enter valid JSON.',
      );
      return;
    }

    mutation.mutate(value);
  }

  function saveBoolean(next: boolean) {
    setJsonError(null);
    setSaveError(null);
    mutation.mutate(next);
  }

  const label = describeKey(setting.key);
  const errorMessage = jsonError ?? saveError;

  return (
    <div className="flex flex-col gap-1.5 border-b border-border py-3 last:border-b-0 md:flex-row md:items-start md:justify-between md:gap-4">
      <div className="flex-1">
        <p className="text-sm font-medium text-text">{label}</p>
        {setting.description && <p className="text-xs text-subtle">{setting.description}</p>}
        {!setting.configured && !errorMessage && (
          <p className="text-xs text-subtle">Not set</p>
        )}
        {errorMessage && <p className="text-sm text-error">{errorMessage}</p>}
      </div>

      <div className="w-full shrink-0 md:w-72">
        {setting.type === 'boolean' ? (
          <div className="flex items-center justify-end md:justify-end">
            <Switch
              aria-label={setting.key}
              checked={Boolean(setting.value)}
              disabled={mutation.isPending}
              onCheckedChange={saveBoolean}
            />
          </div>
        ) : setting.type === 'json' || setting.type === 'string[]' ? (
          <textarea
            aria-label={setting.key}
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value);
              clearErrors();
            }}
            onBlur={(e) => saveIfChanged(e.target.value)}
            rows={3}
            className={cn(
              'w-full rounded-lg border border-border bg-elevated px-3 py-2 text-sm text-text',
              'placeholder:text-subtle font-mono',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-from)]',
              errorMessage && 'border-error',
            )}
            placeholder={setting.configured ? undefined : 'Not set'}
          />
        ) : (
          <Input
            aria-label={setting.key}
            type={setting.type === 'int' ? 'number' : 'text'}
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value);
              clearErrors();
            }}
            onBlur={(e) => saveIfChanged(e.target.value)}
            placeholder={setting.configured ? undefined : 'Not set'}
            className={errorMessage ? 'border-error' : undefined}
          />
        )}
        {mutation.isPending && <p className="mt-1 text-xs text-subtle">Saving…</p>}
        {mutation.isSuccess && !mutation.isPending && (
          <p className="mt-1 text-xs text-subtle">Saved</p>
        )}
      </div>
    </div>
  );
}
