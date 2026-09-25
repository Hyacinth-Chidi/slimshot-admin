'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Eye, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ApiError } from '@/lib/api/client';
import { fieldErrors, validationSummary } from '@/lib/api/field-errors';
import { revealSecret, updateSetting, type MaskedSetting } from '@/lib/api/settings';
import { fetchMe } from '@/lib/auth/profile';
import { cn } from '@/lib/cn';
import { handleMutationError } from '@/lib/query-errors';
import { useIdleTimer } from '@/lib/use-idle-timer';
import { toast } from '@/lib/use-toast';
import { PasswordModal } from './password-modal';

/**
 * Constant, and deliberately NOT the API's mask: `clo••••4f2a` shows a prefix
 * and suffix of the real credential, which leaks more than a lock implies.
 */
export const LOCKED_PLACEHOLDER = '••••••••••';

/** Spec §6.5 trigger 4. Reset on each keystroke in the field, never on render. */
export const IDLE_LOCK_MS = 120_000;

function isForbidden(err: unknown): boolean {
  // Duck-typed on purpose (R12b): anything carrying a 403 is an expired or
  // consumed grant, whether or not it is an ApiError instance.
  return typeof err === 'object' && err !== null && (err as { status?: unknown }).status === 403;
}

/**
 * A secret setting: locked → unlocked (password) → re-locked.
 *
 * Where the secret lives, and nowhere else:
 * - The revealed value and the grant: this component's `value` / `grant`
 *   state (and, while unlocked, the DOM input's value). Every re-lock sets
 *   both to null, so the strings are dropped, not hidden.
 * - The password: the password modal's form state, cleared on submit, and the
 *   frame of the in-flight reveal call.
 * Nothing here goes through TanStack Query — not the reveal (a query would
 * cache the value) and not the save (a mutation keeps its variables).
 * Refs hold only a lock counter; the idle timer and event listeners call
 * `lock`, which closes over state setters only, never the value.
 */
export function SecretField({ setting }: { setting: MaskedSetting }) {
  const queryClient = useQueryClient();
  const inputId = useId();
  const keyId = useId();

  const [value, setValue] = useState<string | null>(null);
  const [grant, setGrant] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [revealing, setRevealing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  // Bumped on every lock, so a reveal that resolves after the field was
  // re-locked (tab hidden mid-request) is discarded instead of unlocking a
  // field nobody is looking at.
  const lockEpoch = useRef(0);

  const unlocked = value !== null;

  const dropSecret = useCallback(() => {
    lockEpoch.current += 1;
    setValue(null);
    setGrant(null);
  }, []);

  const { reset: resetIdle, clear: clearIdle } = useIdleTimer(IDLE_LOCK_MS, dropSecret, unlocked);

  const lock = useCallback(() => {
    clearIdle();
    dropSecret();
  }, [clearIdle, dropSecret]);

  // Trigger 2: tab hidden, or the window losing focus. Listening while a
  // reveal is in flight too, so the race above bumps the counter.
  const exposed = unlocked || revealing;
  useEffect(() => {
    if (!exposed) return;
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') lock();
    };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('blur', lock);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('blur', lock);
    };
  }, [exposed, lock]);

  // Trigger 3 (unmount / navigation) needs no code of its own: the state
  // holding the value is discarded with the component, useIdleTimer clears
  // its timer, and the effect above removes its listeners.

  const handleUnlock = useCallback(
    async (password: string): Promise<string | null> => {
      const epoch = lockEpoch.current;
      setRevealing(true);
      try {
        // R12d: make sure the session is live BEFORE the password leaves the
        // browser. The reveal itself is never refresh-retried (a resend
        // would spend a second lockout attempt), and the server's guard 401
        // shares its code with "Password is incorrect.", so an expired
        // access token would otherwise fail every unlock until a reload.
        // A cheap withRefresh-wrapped GET /auth/me refreshes it instead;
        // guard 401s never reach the lockout counter, so this is safe.
        try {
          await fetchMe();
        } catch (err) {
          if (err instanceof ApiError && err.status === 401) {
            // The refresh itself failed: the session is gone. Lock, close,
            // and take the same §9 path as a mutation's 401.
            lock();
            setModalOpen(false);
            handleMutationError(err);
            return null;
          }
          return err instanceof Error && err.message ? err.message : 'Could not unlock this setting.';
        }
        // A re-lock during the pre-check discards the attempt before the
        // password is sent.
        if (epoch !== lockEpoch.current) {
          return 'The field locked again while unlocking. Try again.';
        }

        // Direct call, never useQuery: the value must not enter the cache.
        // revealSecret is not retried (a failure spends a lockout attempt).
        const result = await revealSecret(setting.key, password);
        if (epoch !== lockEpoch.current) {
          return 'The field locked again while unlocking. Try again.';
        }
        // An unconfigured secret still unlocks, so it can be set.
        setValue(typeof result.value === 'string' ? result.value : '');
        setGrant(result.grant);
        setError(null);
        setSaved(false);
        setModalOpen(false);
        return null;
      } catch (err) {
        return err instanceof Error && err.message ? err.message : 'Could not unlock this setting.';
      } finally {
        setRevealing(false);
      }
    },
    [setting.key, lock],
  );

  async function save() {
    if (value === null || saving) return;
    setSaving(true);
    setError(null);
    try {
      await updateSetting(setting.key, value, grant ? { grant } : {});
      // Trigger 1: re-mask the moment the save lands.
      lock();
      setSaved(true);
      queryClient.invalidateQueries({ queryKey: ['settings', setting.group] });
    } catch (err) {
      if (isForbidden(err)) {
        // The 120s grant and the 2-minute UI lock drift apart. An expired
        // grant is an ordinary re-prompt, not an error.
        lock();
        setModalOpen(true);
        return;
      }
      if (err instanceof ApiError && err.status === 401) {
        // withRefresh already tried and the refresh failed. This save is not
        // a useMutation (its cache would keep the secret), so the global
        // MutationCache redirect never sees it: drop the value first, then
        // take the same §9 path by hand.
        lock();
        handleMutationError(err);
        return;
      }
      if (err instanceof ApiError && err.status === 422) {
        // Validated before the grant is spent server-side, so the field stays
        // unlocked for a corrected retry.
        const errors = fieldErrors(err);
        setError(errors[setting.key] ?? errors.value ?? validationSummary(err));
        return;
      }
      toast(err instanceof Error ? err.message : 'Failed to save setting.', 'error');
    } finally {
      setSaving(false);
    }
  }

  const displayValue = unlocked ? value : setting.configured ? LOCKED_PLACEHOLDER : '';

  return (
    <div className="flex flex-col gap-1.5 border-b border-border py-3 last:border-b-0 md:flex-row md:items-start md:justify-between md:gap-4">
      <div className="flex-1">
        <label htmlFor={inputId} className="text-sm font-medium text-text">
          {setting.description}
        </label>
        <p id={keyId} className="font-mono text-xs text-subtle">
          {setting.key}
        </p>
        {!setting.configured && !unlocked && !error && (
          <p className="text-xs text-subtle">Not set</p>
        )}
        {error && (
          <p role="alert" className="text-sm text-error">
            {error}
          </p>
        )}
      </div>

      <div className="w-full shrink-0 md:w-72">
        <div className="flex items-center gap-2">
          <Input
            id={inputId}
            aria-describedby={keyId}
            type="text"
            autoComplete="off"
            spellCheck={false}
            readOnly={!unlocked}
            value={displayValue}
            onChange={(e) => {
              if (!unlocked) return;
              setValue(e.target.value);
              setError(null);
              setSaved(false);
              resetIdle();
            }}
            onKeyDown={(e) => {
              if (!unlocked) return;
              resetIdle();
              if (e.key === 'Enter') void save();
            }}
            className={cn(
              'font-mono',
              !unlocked && 'cursor-default opacity-60',
              error && 'border-error',
            )}
          />
          {unlocked ? (
            <>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="w-11 shrink-0 p-0 md:w-8"
                onClick={lock}
              >
                <Lock aria-hidden className="size-4" />
                <span className="sr-only">Lock {setting.description}</span>
              </Button>
              <Button
                type="button"
                variant="primary"
                size="sm"
                className="shrink-0"
                onClick={() => void save()}
                disabled={saving}
              >
                {saving ? 'Saving…' : 'Save'}
              </Button>
            </>
          ) : (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="w-11 shrink-0 p-0 md:w-8"
              onClick={() => setModalOpen(true)}
            >
              <Eye aria-hidden className="size-4" />
              <span className="sr-only">Reveal {setting.description}</span>
            </Button>
          )}
        </div>
        {saved && !unlocked && <p className="mt-1 text-xs text-subtle">Saved</p>}
      </div>

      <PasswordModal
        open={modalOpen}
        settingKey={setting.key}
        onUnlock={handleUnlock}
        onClose={() => setModalOpen(false)}
      />
    </div>
  );
}
