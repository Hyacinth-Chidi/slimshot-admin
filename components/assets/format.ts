/** m:ss, per spec §6.2 — durations under an hour never need an hours place. */
export function formatDuration(durationMs: number | null): string {
  if (durationMs === null || Number.isNaN(durationMs)) return '—';

  const totalSeconds = Math.max(0, Math.round(durationMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

/** Short absolute date for the table/card "created" field. */
export function formatCreatedDate(createdAt: string | null): string {
  if (!createdAt) return '—';

  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) return '—';

  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}
