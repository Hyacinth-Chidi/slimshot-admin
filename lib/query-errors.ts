import { ApiError } from '@/lib/api/client';
import type { Toast } from '@/lib/use-toast';

type ToastFn = (message: string, variant?: Toast['variant']) => void;

/**
 * A 401 here means withRefresh already tried once and the refresh itself
 * failed (see lib/auth/session.ts) — there is no token left to retry with,
 * so the only correct move is to send the user back to /login.
 */
function isUnauthorized(error: unknown): error is ApiError {
  return error instanceof ApiError && error.status === 401;
}

/** Queries retry transient failures once, but never a 4xx ApiError — a
 * 401/403/404/422 will fail identically on retry, so retrying just repeats
 * the same error at extra cost. */
export function shouldRetryQuery(failureCount: number, error: unknown): boolean {
  if (error instanceof ApiError && error.status >= 400 && error.status < 500) {
    return false;
  }
  return failureCount < 1;
}

export function handleQueryError(error: unknown, toast: ToastFn): void {
  if (isUnauthorized(error)) {
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- full navigation is intentional: it drops the in-memory token and query cache.
    window.location.assign('/login');
    return;
  }

  const message = error instanceof Error ? error.message : 'Something went wrong.';
  toast(message, 'error');

  if (error instanceof ApiError) {
    // Deliberate console.error: ties a user report to a server log line.
    console.error(`API error traceId: ${error.traceId}`);
  }
}

export function handleMutationError(error: unknown): void {
  // Non-401 mutation errors are left to the component: a 409 opens a dialog,
  // a 422 maps onto form fields. Only the session-expired case is global.
  if (isUnauthorized(error)) {
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- full navigation is intentional: it drops the in-memory token and query cache.
    window.location.assign('/login');
  }
}
