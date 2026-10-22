import { apiFetch, apiFetchEnvelope } from './client';
import { withRefresh } from '@/lib/auth/session';
import type { AssetStatus } from '@/components/ui/status-pill';

/**
 * The admin API's asset view (server spec §5.2): the public shape plus status,
 * category, dates and the files the admin may see (original and cover).
 */
export interface Asset {
  id: string;
  kind: string;
  title: string;
  author: string | null;
  status: AssetStatus | null;
  categoryId: string | null;
  durationMs: number | null;
  createdAt: string | null;
  /** The cover image, when the asset has one. */
  coverUrl: string | null;
  /** The uploaded file itself, for listening in the dashboard. */
  originalUrl: string | null;
  /** A font's preview image, drawn by the server from the file. */
  previewUrl: string | null;
  /**
   * A font that was ever published: projects may use it, so the server
   * refuses to unpublish or delete it. Always false for sounds.
   */
  keptForGood: boolean;
}

/** What the server read from a font file, plus the owner's licence note. */
export interface FontDetail {
  familyName: string;
  styleName: string;
  fullName: string;
  postscriptName: string | null;
  version: number;
  sortOrder: number;
  /** Set once, on first publish: from then on the font is kept for good. */
  firstPublishedAt: string | null;
  license: string | null;
}

/** One asset in full, for its own page. */
export interface AssetDetail extends Asset {
  slug: string;
  byteSize: number | null;
  format: string | null;
  publishedAt: string | null;
  downloadCount: number;
  /** Null for every kind but font. */
  font: FontDetail | null;
}

interface ServerFile {
  url: string;
  byteSize?: number;
  format?: string;
  durationMs?: number;
}

interface ServerAsset {
  id: string;
  slug: string;
  kind: string;
  title: string;
  author: string;
  tags: string[];
  files: Record<string, ServerFile>;
  detail: Record<string, unknown>;
  stats: { downloadCount: number };
  status?: AssetStatus;
  visibility?: string;
  categoryId?: string | null;
  createdAt?: string;
  publishedAt?: string | null;
  font?: FontDetail | null;
}

/**
 * Cursor-paginated: `meta` is a SIBLING of `data`, exactly like /audit-logs.
 * It must be read with apiFetchEnvelope — apiFetch unwraps `data` and
 * silently discards nextCursor, so pagination would stop after page one with
 * no error.
 */
export type AssetPage = { data: Asset[]; meta: { nextCursor: string | null } };

export interface AssetFilters {
  kind?: string;
  status?: AssetStatus;
  /** That category and everything under it. */
  categoryId?: string;
  search?: string;
  cursor?: string;
  limit?: number;
}

/**
 * The server's AssetKind enum (../slimshot_server/src/generated/prisma/enums.ts:12-16).
 * Only `audio` has a registered kind descriptor today (kind-registry.ts throws
 * for an unregistered kind), but all three are valid, accepted `kind` values.
 */
const KNOWN_KINDS = new Set(['audio', 'font', 'template']);

function toDurationMs(detail: Record<string, unknown>): number | null {
  const value = detail.durationMs;
  return typeof value === 'number' ? value : null;
}

/** A server status wins; for an older server without one, an active status filter is still true. */
function toAsset(row: ServerAsset, activeStatus?: AssetStatus): Asset {
  return {
    id: row.id,
    kind: row.kind,
    title: row.title,
    author: row.author || null,
    status: row.status ?? activeStatus ?? null,
    categoryId: row.categoryId ?? null,
    createdAt: row.createdAt ?? null,
    durationMs: toDurationMs(row.detail),
    coverUrl: row.files.thumbnail?.url || null,
    originalUrl: row.files.original?.url || null,
    previewUrl: row.files.specimen?.url || null,
    keptForGood: Boolean(row.font?.firstPublishedAt),
  };
}

function toDetail(row: ServerAsset): AssetDetail {
  const original = row.files.original;
  return {
    ...toAsset(row),
    slug: row.slug,
    byteSize: original?.byteSize ?? null,
    format: original?.format ?? null,
    publishedAt: row.publishedAt ?? null,
    downloadCount: row.stats.downloadCount,
    font: row.font ?? null,
  };
}

/**
 * ListAssetsDto accepts kind, status, categoryId, q, cursor, limit (the
 * free-text filter is `q`, not `search`). The server rejects unknown params
 * and an invalid `kind` (@IsEnum), so `kind` is checked against the known enum
 * and an unrecognised value is dropped rather than risk the request.
 */
export function fetchAssets(filters: AssetFilters = {}): Promise<AssetPage> {
  const { search, kind } = filters;
  const rest: Omit<AssetFilters, 'search' | 'kind'> = {
    status: filters.status,
    categoryId: filters.categoryId,
    cursor: filters.cursor,
    limit: filters.limit,
  };
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(rest)) {
    if (v !== undefined && v !== '') qs.set(k, String(v));
  }
  if (kind && KNOWN_KINDS.has(kind)) qs.set('kind', kind);
  if (search) qs.set('q', search);

  const suffix = qs.toString() ? `?${qs}` : '';
  return withRefresh(async () => {
    const { data, meta } = await apiFetchEnvelope<ServerAsset[], { nextCursor: string | null }>(
      `/assets${suffix}`,
    );
    return { data: data.map((row) => toAsset(row, filters.status)), meta };
  });
}

export function fetchAsset(id: string): Promise<AssetDetail> {
  return withRefresh(async () => toDetail(await apiFetch<ServerAsset>(`/assets/${encodeURIComponent(id)}`)));
}

/** `categoryId: null` removes the category. Only the fields given are changed. */
export function updateAsset(
  id: string,
  patch: { title?: string; authorName?: string; categoryId?: string | null },
): Promise<AssetDetail> {
  return withRefresh(async () =>
    toDetail(
      await apiFetch<ServerAsset>(`/assets/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: JSON.stringify(patch),
      }),
    ),
  );
}

export function removeCover(id: string): Promise<void> {
  return withRefresh(async () => {
    await apiFetch<undefined>(`/assets/${encodeURIComponent(id)}/cover`, { method: 'DELETE' });
  });
}

export function publishAsset(id: string): Promise<unknown> {
  return withRefresh(() => apiFetch(`/assets/${id}/publish`, { method: 'POST' }));
}

export function unpublishAsset(id: string): Promise<unknown> {
  return withRefresh(() => apiFetch(`/assets/${id}/unpublish`, { method: 'POST' }));
}

export function deleteAsset(id: string): Promise<unknown> {
  return withRefresh(() => apiFetch(`/assets/${id}`, { method: 'DELETE' }));
}
