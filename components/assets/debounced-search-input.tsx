'use client';

import { useEffect, useState } from 'react';
import { Input } from '@/components/ui/input';
import { useDebouncedValue } from './use-debounced-value';

/**
 * Owns its own local state so every keystroke shows up immediately — an
 * earlier version derived its value straight from useSearchParams, so each
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
 * This component is NEVER remounted by its own commit (an earlier version
 * relied on the caller keying it by `value`, which meant every debounced
 * commit — the component's own typing! — remounted it, dropping focus and
 * losing any keystrokes typed during the remount window; assets-page-content.tsx
 * no longer keys its body on the URL for the same reason). Instead it
 * resyncs `draft` from an incoming `value` only when that value is both new
 * (differs from `lastSeenValue`, the last `value` this component has
 * already processed) and NOT simply this component's own commit catching up
 * (differs from `debounced`, what this component itself just wrote or is
 * about to write) — see the comment at the render-time check below for why
 * both halves of that guard are necessary. This follows React's "adjust
 * state during render when a prop changes" pattern
 * (https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes)
 * rather than a `[value]`-keyed effect, which this repo's
 * `react-hooks/set-state-in-effect` lint rule forbids, and never reads or
 * writes a ref during render, which `react-hooks/refs` forbids.
 */
export function DebouncedSearchInput({
  value,
  buildUrl,
  delayMs = 300,
}: {
  /** The committed value, from the URL. */
  value: string;
  /** Given the new search text, returns the full URL (path + query) to replace history with. */
  buildUrl: (search: string) => string;
  delayMs?: number;
}) {
  const [draft, setDraft] = useState(value);
  // The last `value` prop this component has already accounted for — either
  // because it initialized `draft` from it (mount) or because it resynced
  // `draft` to it (an external change, handled below).
  const [lastSeenValue, setLastSeenValue] = useState(value);
  const debounced = useDebouncedValue(draft, delayMs);

  // Adjust state during render (not an effect, not a ref — see the class
  // comment): if `value` changed to something this component hasn't already
  // seen AND it isn't simply catching up to what this component itself is
  // about to commit (or already has), resync `draft` to it.
  //
  // The `value !== debounced` half of the guard is load-bearing, not
  // redundant with `value !== lastSeenValue`: `history.replaceState` is a
  // browser API write, not a React state update, so the `value` prop does
  // NOT update synchronously with this component's own commit — the next
  // render still sees the OLD `value` for at least one render, sometimes
  // more (whatever it takes the parent's useSearchParams to catch up).
  // Comparing only against `lastSeenValue` would treat that lag as "the
  // committed value moved backward, external reset" and wipe out `draft`
  // (losing anything the user typed since committing) the moment `value`
  // finally arrives. Comparing against `debounced` too means: if the
  // incoming `value` matches what we already debounced-and-committed (or
  // are about to), it's just an echo of our own write catching up, not new
  // external information — skip the reset.
  if (value !== lastSeenValue) {
    setLastSeenValue(value);
    // Only touch `draft` for a genuinely new external value — if `value`
    // merely caught up to what this component already debounced (an echo
    // of its own commit), leave `draft` alone so newer keystrokes typed
    // since that commit aren't overwritten.
    if (value !== debounced) setDraft(value);
  }

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
