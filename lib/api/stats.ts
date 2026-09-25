import { apiFetch } from './client';
import { withRefresh } from '@/lib/auth/session';

export interface StatsSummary {
  totalAssets: number;
  failedCount: number;
  totalBytes: number;
  /** Keyed maps, populated ONLY with statuses/kinds that have rows. */
  byStatus: Record<string, number>;
  byKind: Record<string, number>;
}

/** Verified against the live API: there is no publishedCount/processingCount. */
export function tileCounts(s: StatsSummary) {
  return {
    total: s.totalAssets,
    published: s.byStatus.published ?? 0,
    processing: s.byStatus.processing ?? 0,
    failed: s.failedCount,
  };
}

export interface UploadPoint {
  date: string;
  count: number;
}

export function fetchSummary(): Promise<StatsSummary> {
  return withRefresh(() => apiFetch<StatsSummary>('/stats/summary'));
}

export function fetchUploads(days: number): Promise<UploadPoint[]> {
  return withRefresh(() => apiFetch<UploadPoint[]>(`/stats/uploads-over-time?days=${days}`));
}

/**
 * The API returns ONLY days that have data, so a 30-day window can come back
 * with three entries. Zero-filling here keeps the x-axis honest; plotting the
 * raw array would space three points evenly across a month and imply uploads
 * on days that had none.
 */
export function zeroFill(points: UploadPoint[], days: number, today = new Date()): UploadPoint[] {
  const byDate = new Map(points.map((p) => [p.date, p.count]));
  const out: UploadPoint[] = [];

  for (let i = days - 1; i >= 0; i -= 1) {
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() - i);
    const key = d.toISOString().slice(0, 10);
    out.push({ date: key, count: byDate.get(key) ?? 0 });
  }
  return out;
}

/**
 * Decides what to feed the Sparkline. A zero-filled series where every count
 * is 0 (new install, or a genuinely quiet month) should render the "No
 * uploads yet" empty state rather than a flat line at zero, which reads as a
 * chart that failed to load rather than a chart with nothing to show.
 */
export function sparklinePoints(filled: UploadPoint[]): number[] {
  if (filled.every((p) => p.count === 0)) return [];
  return filled.map((p) => p.count);
}

export interface JobsHealth {
  waiting: number;
  active: number;
  failed: number;
  delayed: number;
}

/** The only jobs route that exists. Never call /jobs/failed or /jobs/:id/retry. */
export function fetchJobsHealth(): Promise<JobsHealth> {
  return withRefresh(() => apiFetch<JobsHealth>('/jobs/health'));
}
