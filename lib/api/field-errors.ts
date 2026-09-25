import { ApiError } from './client';

/**
 * Spec section 9: a 422 maps onto the offending form fields rather than
 * becoming a generic toast. The server returns details as
 * `{ field: string[] }`; anything else falls through to the caller's toast.
 */
export function fieldErrors(err: unknown): Record<string, string> {
  if (!(err instanceof ApiError) || err.status !== 422 || !err.details) return {};

  const out: Record<string, string> = {};
  for (const [field, messages] of Object.entries(err.details)) {
    if (Array.isArray(messages) && messages.length > 0) out[field] = messages.join(', ');
  }
  return out;
}
