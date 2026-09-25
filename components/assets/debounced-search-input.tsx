'use client';

import { useEffect, useState } from 'react';
import { Input } from '@/components/ui/input';
import { useDebouncedValue } from './use-debounced-value';

/**
 * Owns its own local state so every keystroke shows up immediately — the
 * previous version derived its value straight from useSearchParams, so each
 * keystroke went through a router.push transition before the input could
 * show the next character, which both dropped keystrokes and added a
 * history entry (and a "Loading…" flash) per character typed.
 *
 * The debounced value is written back with window.history.replaceState
 * (not router.push/replace), which Next 16 syncs with useSearchParams
 * without adding a history entry or a router transition — see
 * node_modules/next/dist/docs/01-app/01-getting-started/04-linking-and-navigating.md
 * ("Native History API" / replaceState). The parent's useInfiniteQuery
 * re-keys off the resulting searchParams change on its own; this component
 * does not call onChange directly.
 *
 * When `value` changes for a reason other than this component's own typing
 * (filters cleared elsewhere, Back/Forward), the caller must remount this
 * component (e.g. `key={value}` or a wider key that changes together with
 * it) rather than rely on an effect to resync local state — React's own
 * guidance is to reset state via `key`, not by calling setState from a
 * `[value]` effect, which the project's lint rules (`react-hooks/refs`,
 * `react-hooks/set-state-in-effect`) also forbid. assets-page-content.tsx
 * already remounts its whole filtered view on any searchParams change via
 * `key={searchParams.toString()}`, so this holds in practice.
 */
export function DebouncedSearchInput({
  value,
  buildUrl,
  delayMs = 300,
}: {
  /** The committed value, from the URL, used only as the initial draft. */
  value: string;
  /** Given the new search text, returns the full URL (path + query) to replace history with. */
  buildUrl: (search: string) => string;
  delayMs?: number;
}) {
  const [draft, setDraft] = useState(value);
  const debounced = useDebouncedValue(draft, delayMs);

  useEffect(() => {
    if (debounced === value) return;
    window.history.replaceState(null, '', buildUrl(debounced));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced]);

  return (
    <Input
      placeholder="Search title…"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      className="md:w-56"
      aria-label="Search"
    />
  );
}
