import { apiFetch, apiFetchEnvelope } from './client';
import { withRefresh } from '@/lib/auth/session';
import type { AssetStatus } from '@/components/ui/status-pill';

/**
 * Verified against ../slimshot_server/src (read-only), not the live API — the
 * api-reference's /assets sample was captured with an empty dev database, so
 * it never showed a real item.
 *
 * The server's list item (AssetKindDescriptor#toPublicDto, e.g.
 * kinds/audio/audio.descriptor.ts:59-73) returns
 * `{ id, slug, kind, title, author, tags, files, detail, stats }` — it does
 * NOT include `status`, `categoryId`, or `createdAt`, even though the Prisma
 * Asset row has all three (generated/prisma/models/Asset.ts). Every asset
 * kind descriptor funnels through the same AssetService.list()
 * (modules/assets/asset.service.ts:33-60), and AdminAssetsController.list
 * (modules/admin/admin-assets.controller.ts:33-38) calls that same method —
 * there is no richer admin-only serializer anywhere in the server. So the
 * fields this admin UI needs for the status pill, the category filter link
 * from Task 10, and the "created" column are genuinely absent from
 * GET /assets today. fetchAssets below maps the real response onto this
 * shape: `status` is filled in truthfully from an active status filter
 * (R8e — the server already filtered on it) and left `null` otherwise;
 * `categoryId`/`createdAt` are always `null` rather than a fabricated guess.
 * See task-8-report.md for the full writeup and suggested server fix (add
 * status/categoryId/createdAt to PublicAsset).
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
}

/**
 * The server's real list-item shape (asset-kind.interface.ts:28-38). `detail`
 * is kind-specific — for `audio` it holds `durationMs`/`bpm`/`isLoopable`
 * (kinds/audio/audio.descriptor.ts:67-71); other kinds aren't implemented
 * server-side yet (kind-registry.ts throws for an unregistered kind).
 */
interface ServerAsset {
  id: string;
  slug: string;
  kind: string;
  title: string;
  author: string;
  tags: string[];
  files: Record<string, { url: string; durationMs?: number }>;
  detail: Record<string, unknown>;
  stats: { downloadCount: number };
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
  /**
   * Round-tripped through the URL (R8c) but never sent to the server — see
   * R8f below. Kept on the filters type so filters-url.ts and the "view
   * blocking assets" link (Task 10) still have somewhere to carry it.
   */
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

/**
 * R8e: when the list is filtered by status, every returned row genuinely has
 * that status — the server already filtered on it (asset.service.ts:33-60).
 * Unfiltered, status is unknown and must not be guessed.
 */
function toAsset(row: ServerAsset, activeStatus: AssetStatus | undefined): Asset {
  return {
    id: row.id,
    kind: row.kind,
    title: row.title,
    author: row.author || null,
    status: activeStatus ?? null,
    // Not present on the server's list item — see the module comment above.
    categoryId: null,
    createdAt: null,
    durationMs: toDurationMs(row.detail),
  };
}

/**
 * ListAssetsDto (../slimshot_server/src/modules/assets/dto/list-assets.dto.ts)
 * accepts kind, status, q, cursor, limit — the free-text filter is `q`, not
 * `search`.
 *
 * R8f: the server runs a global `ValidationPipe({ whitelist: true,
 * forbidNonWhitelisted: true })` (main.ts:19-24). ListAssetsDto has no
 * `categoryId` field, so sending it 400s the whole request rather than being
 * silently ignored — confirmed by rereading main.ts after the first review
 * round; the original report's "harmless unknown param" was wrong.
 * `categoryId` is therefore dropped here, never forwarded to the API. An
 * invalid `kind` would similarly 400 (`@IsEnum` on ListAssetsDto), so `kind`
 * is validated against the server's known enum before being sent; an
 * unrecognized value is dropped rather than risk the request.
 */
export function fetchAssets(filters: AssetFilters = {}): Promise<AssetPage> {
  const { search, kind } = filters;
  // categoryId is deliberately never read from `filters` — see the R8f note
  // above — so `rest` below only ever contains status/cursor/limit.
  const rest: Omit<AssetFilters, 'search' | 'kind' | 'categoryId'> = {
    status: filters.status,
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

export function publishAsset(id: string): Promise<unknown> {
  return withRefresh(() => apiFetch(`/assets/${id}/publish`, { method: 'POST' }));
}

export function unpublishAsset(id: string): Promise<unknown> {
  return withRefresh(() => apiFetch(`/assets/${id}/unpublish`, { method: 'POST' }));
}

export function deleteAsset(id: string): Promise<unknown> {
  return withRefresh(() => apiFetch(`/assets/${id}`, { method: 'DELETE' }));
}
