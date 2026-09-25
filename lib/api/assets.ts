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
 * shape and fills the unavailable fields with `null` rather than a fabricated
 * guess; see task-8-report.md for the full writeup and suggested server fix
 * (add status/categoryId/createdAt to PublicAsset).
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
  categoryId?: string;
  search?: string;
  cursor?: string;
  limit?: number;
}

function toDurationMs(detail: Record<string, unknown>): number | null {
  const value = detail.durationMs;
  return typeof value === 'number' ? value : null;
}

function toAsset(row: ServerAsset): Asset {
  return {
    id: row.id,
    kind: row.kind,
    title: row.title,
    author: row.author || null,
    // Not present on the server's list item — see the module comment above.
    status: null,
    categoryId: null,
    createdAt: null,
    durationMs: toDurationMs(row.detail),
  };
}

/**
 * ListAssetsDto (../slimshot_server/src/modules/assets/dto/list-assets.dto.ts)
 * accepts kind, status, q, cursor, limit — the free-text filter is `q`, not
 * `search`, and there is no `categoryId` or sort param server-side. `search`
 * is translated to `q` here so the rest of this app can use the vocabulary
 * the spec and Task 10's link use; `categoryId` is sent anyway (harmless
 * unknown query param today) so the mapping is a one-line fix once the
 * server adds the filter — see the report for why it's not silently dropped.
 */
export function fetchAssets(filters: AssetFilters = {}): Promise<AssetPage> {
  const qs = new URLSearchParams();
  const { search, ...rest } = filters;
  for (const [k, v] of Object.entries(rest)) {
    if (v !== undefined && v !== '') qs.set(k, String(v));
  }
  if (search) qs.set('q', search);

  const suffix = qs.toString() ? `?${qs}` : '';
  return withRefresh(async () => {
    const { data, meta } = await apiFetchEnvelope<ServerAsset[], { nextCursor: string | null }>(
      `/assets${suffix}`,
    );
    return { data: data.map(toAsset), meta };
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
