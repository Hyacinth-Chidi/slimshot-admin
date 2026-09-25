import type { AssetStatus } from '@/components/ui/status-pill';

/**
 * The bulk bar acts on every selected row at once, so — unlike the per-row
 * menu, which knows each row's real status — it can only reason from the
 * active status filter. Per the review: Unpublish is offered only when the
 * filter is exactly `published` (every visible row genuinely is published,
 * R8e); Publish is offered when the filter is `ready`/`archived`, OR when
 * there's no status filter at all (the server's own PUBLISHABLE_FROM check,
 * asset.service.ts:19-22 and :100-105, is the backstop for any row that
 * turns out not to be publishable).
 */
export function bulkCanPublish(statusFilter: AssetStatus | undefined): boolean {
  return statusFilter === undefined || statusFilter === 'ready' || statusFilter === 'archived';
}

export function bulkCanUnpublish(statusFilter: AssetStatus | undefined): boolean {
  return statusFilter === 'published';
}
