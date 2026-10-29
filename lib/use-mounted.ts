import { useSyncExternalStore } from 'react';

const subscribe = () => () => {};

/**
 * False on the server and while hydrating, true once mounted. Anything that
 * depends on client-only state (the cached profile, the role) renders behind
 * it, so the browser's first render matches the server's HTML.
 */
export function useMounted(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}
