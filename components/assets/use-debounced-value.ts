import { useEffect, useState } from 'react';

/**
 * Delays echoing a fast-changing value (keystrokes) until it's been stable
 * for `delayMs`. Used to keep the URL — and therefore the query key and the
 * router transition — from updating on every keystroke, which was dropping
 * characters (each transition re-rendered the input from a searchParams
 * value that was already stale by the time it came back) and adding a
 * history entry per keystroke.
 */
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}
