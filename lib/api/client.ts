import type { ApiEnvelope, ApiErrorBody } from './types';

export class ApiError extends Error {
  readonly code: string;
  readonly details?: Record<string, string[]>;
  readonly traceId: string;
  readonly status: number;

  constructor(body: ApiErrorBody, status: number) {
    super(body.message);
    this.name = 'ApiError';
    this.code = body.code;
    this.details = body.details;
    this.traceId = body.traceId;
    this.status = status;
  }
}

// Memory only. Never localStorage: an XSS can read localStorage, and the
// whole point of keeping the refresh token in an httpOnly cookie is undone if
// the access token sits somewhere script can reach.
let accessToken: string | null = null;

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

export function getAccessToken(): string | null {
  return accessToken;
}

export const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE ?? 'http://localhost:3000/api/admin/v1';

/**
 * Private helper that builds headers, performs the fetch, and parses JSON.
 * Throws an ApiError on unreadable bodies, returning the parsed body and response status.
 */
async function fetchAndParseJson<T>(
  path: string,
  init?: RequestInit,
): Promise<{ body: T; status: number }> {
  const headers = new Headers(init?.headers);
  if (!headers.has('content-type') && init?.body) {
    headers.set('content-type', 'application/json');
  }
  if (accessToken) headers.set('authorization', `Bearer ${accessToken}`);

  const res = await fetch(`${API_BASE}${path}`, { ...init, headers });

  let body: T;
  try {
    body = (await res.json()) as T;
  } catch {
    // A proxy 502 returns HTML. Surface something actionable rather than a
    // SyntaxError from deep inside the fetch layer.
    throw new ApiError(
      {
        code: 'NETWORK',
        message: `The server returned an unreadable response (${res.status}).`,
        traceId: 'none',
      },
      res.status,
    );
  }

  return { body, status: res.status };
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const { body, status } = await fetchAndParseJson<ApiEnvelope<T>>(path, init);

  if (!body.success) throw new ApiError(body.error, status);
  return body.data;
}

/**
 * Like apiFetch, but keeps `meta` alongside `data`. Cursor-paginated endpoints
 * put nextCursor in meta as a sibling of data, and apiFetch's unwrapping drops
 * it — which makes pagination stop after one page without any error.
 */
export async function apiFetchEnvelope<T, M = unknown>(
  path: string,
  init?: RequestInit,
): Promise<{ data: T; meta: M }> {
  const { body, status } = await fetchAndParseJson<{
    success: boolean;
    data?: T;
    meta?: M;
    error?: ApiErrorBody;
  }>(path, init);

  if (!body.success || body.data === undefined) {
    throw new ApiError(
      body.error ?? { code: 'UNKNOWN', message: 'Request failed.', traceId: 'none' },
      status,
    );
  }
  return { data: body.data, meta: body.meta as M };
}
