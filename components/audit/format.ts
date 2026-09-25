/** Absolute, readable timestamp for the audit log — this screen is a record, not a feed. */
export function formatAuditTimestamp(createdAt: string): string {
  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) return '—';

  return date.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

/**
 * Ids in this system (cuids) are long, and pushing the full string into a
 * table cell or card either forces horizontal scroll or crowds out every
 * other column. Short form keeps enough to recognise/compare at a glance;
 * the full id is still available via the title attribute the caller sets.
 */
export function shortId(id: string | null): string {
  if (!id) return '—';
  return id.length <= 10 ? id : `${id.slice(0, 6)}…${id.slice(-4)}`;
}
