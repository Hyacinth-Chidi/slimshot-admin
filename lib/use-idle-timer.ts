'use client';

import { useCallback, useEffect, useLayoutEffect, useRef } from 'react';

/**
 * Calls `onIdle` once `ms` elapses without a `reset()` while `active`.
 *
 * `reset` is for the caller to invoke on real input (a keystroke), never on
 * render: a timer that restarts on every render looks identical in a quick
 * demo and never fires for someone who walked away from a re-rendering page.
 *
 * The timer callback reads `onIdle` through a ref rather than capturing it,
 * so a pending timer never pins an old render's closure (and whatever that
 * closure captured). The ref is updated in a layout effect, not during
 * render, per React 19's rules for refs.
 */
export function useIdleTimer(ms: number, onIdle: () => void, active: boolean) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const callback = useRef(onIdle);

  useLayoutEffect(() => {
    callback.current = onIdle;
  }, [onIdle]);

  const clear = useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  }, []);

  const reset = useCallback(() => {
    clear();
    if (active) {
      timer.current = setTimeout(() => {
        timer.current = null;
        callback.current();
      }, ms);
    }
  }, [active, clear, ms]);

  useEffect(() => {
    reset();
    return clear;
  }, [reset, clear]);

  return { reset, clear };
}
