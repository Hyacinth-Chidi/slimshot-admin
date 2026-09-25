/**
 * The filter subset of `fetchAuditLogs`'s params (lib/api/audit.ts) that has
 * UI on this screen — actor, action, entity type, per the brief. Kept as its
 * own type (rather than reusing the fetch function's inline param type) so
 * filters-url.ts and audit-filters.tsx don't need to import the API module.
 */
export interface AuditFilters {
  actorId?: string;
  action?: string;
  entityType?: string;
}
