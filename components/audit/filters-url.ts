import type { AuditFilters } from './audit-filters-types';

/**
 * The server DTO (admin-audit.controller.ts) declares exactly `actorId`,
 * `action`, `entityType`, `entityId`, `cursor`, `limit` as query params, and
 * the global ValidationPipe uses `forbidNonWhitelisted` — any other param is
 * a 400. `cursor`/`limit` are pagination state, not filter state, so they're
 * deliberately not read here (mirrors assets' filters-url.ts). `entityId` is
 * accepted by the server but has no filter UI here (the brief calls out
 * actor/action/entity TYPE only) — reading a stray `entityId` from the URL
 * would silently do nothing useful, so it's left out too, same as any
 * unrecognised param.
 */
export function filtersFromSearchParams(params: URLSearchParams): AuditFilters {
  const filters: AuditFilters = {};

  const actorId = params.get('actorId');
  if (actorId) filters.actorId = actorId;

  const action = params.get('action');
  if (action) filters.action = action;

  const entityType = params.get('entityType');
  if (entityType) filters.entityType = entityType;

  return filters;
}

/** The inverse: what the URL's query string should read once these filters are active. */
export function searchParamsFromFilters(filters: AuditFilters): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.actorId) params.set('actorId', filters.actorId);
  if (filters.action) params.set('action', filters.action);
  if (filters.entityType) params.set('entityType', filters.entityType);
  return params;
}
