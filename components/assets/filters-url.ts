import type { AssetStatus } from '@/components/ui/status-pill';
import type { AssetFilters } from '@/lib/api/assets';

const KNOWN_STATUSES: readonly AssetStatus[] = [
  'draft',
  'processing',
  'ready',
  'published',
  'archived',
  'failed',
];

function isAssetStatus(value: string): value is AssetStatus {
  return (KNOWN_STATUSES as readonly string[]).includes(value);
}

/**
 * Reads the filter state out of the URL on first render, so a link like
 * `/assets?categoryId=<id>` (Task 10's "view blocking assets") lands
 * pre-filtered. `cursor`/`limit` are pagination state, not filter state —
 * they're deliberately not read here.
 */
export function filtersFromSearchParams(params: URLSearchParams): AssetFilters {
  const filters: AssetFilters = {};

  const kind = params.get('kind');
  if (kind) filters.kind = kind;

  const status = params.get('status');
  if (status && isAssetStatus(status)) filters.status = status;

  const categoryId = params.get('categoryId');
  if (categoryId) filters.categoryId = categoryId;

  const search = params.get('search');
  if (search) filters.search = search;

  return filters;
}

/**
 * The inverse: what the URL's query string should read once these filters
 * are active, so changing a filter keeps the URL (and back button, and
 * shareable link) in sync.
 */
export function searchParamsFromFilters(filters: AssetFilters): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.kind) params.set('kind', filters.kind);
  if (filters.status) params.set('status', filters.status);
  if (filters.categoryId) params.set('categoryId', filters.categoryId);
  if (filters.search) params.set('search', filters.search);
  return params;
}
