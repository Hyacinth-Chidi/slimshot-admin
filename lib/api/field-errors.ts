import { ApiError } from './client';

/**
 * The one parser for a 422's `details` (spec section 9: a 422 maps onto the
 * offending form fields rather than becoming a generic toast).
 *
 * The server's exception filter
 * (../slimshot_server/src/core/errors/http-exception.filter.ts:75-80) sends a
 * class-validator failure's `details` as a flat `string[]`, e.g.
 * `["name must be shorter than or equal to 80 characters"]`. Each message
 * starts with the property it is about, so that leading name is the field.
 * A `{ field: string[] }` object is accepted too, for forward-compatibility.
 * Anything else yields `{}` and the caller falls back to validationSummary.
 */
export function fieldErrors(err: unknown): Record<string, string> {
  if (!(err instanceof ApiError) || err.status !== 422) return {};

  const grouped: Record<string, string[]> = {};
  const add = (field: string, message: string) => {
    (grouped[field] ??= []).push(message);
  };

  const { details } = err;
  if (isStringArray(details)) {
    for (const message of details) {
      const field = fieldOf(message);
      if (field) add(field, message);
    }
  } else if (isFieldMap(details)) {
    for (const [field, messages] of Object.entries(details)) {
      for (const message of messages) add(field, message);
    }
  }

  const out: Record<string, string> = {};
  for (const [field, messages] of Object.entries(grouped)) {
    if (messages.length > 0) out[field] = messages.join(', ');
  }
  return out;
}

/**
 * Something readable for a 422 that no form field can show: the server's
 * own messages joined, or the error's message when it sent no details (the
 * envelope message for a class-validator 422 is only "Request validation
 * failed.", which tells the user nothing).
 */
export function validationSummary(err: ApiError): string {
  const { details } = err;
  const messages = isStringArray(details)
    ? details
    : isFieldMap(details)
      ? Object.values(details).flat()
      : [];
  return messages.length > 0 ? messages.join(', ') : err.message;
}

// class-validator prefixes each message with the property path, except a
// whitelist rejection, which reads "property <name> should not exist".
const WHITELIST = /^property (\S+) should not exist$/;
const LEADING_PROPERTY = /^([A-Za-z_$][\w$.]*)\s/;

function fieldOf(message: string): string | undefined {
  return WHITELIST.exec(message)?.[1] ?? LEADING_PROPERTY.exec(message)?.[1];
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((v) => typeof v === 'string');
}

function isFieldMap(value: unknown): value is Record<string, string[]> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    Object.values(value).every(isStringArray)
  );
}
