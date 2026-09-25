'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { fetchAuditLogs } from '@/lib/api/audit';
import { fetchJobsHealth, fetchSummary, fetchUploads, sparklinePoints, tileCounts, zeroFill } from '@/lib/api/stats';
import { HealthStrip } from '@/components/overview/health-strip';
import { Sparkline } from '@/components/overview/sparkline';
import { StatTile } from '@/components/overview/stat-tile';

const UPLOADS_WINDOW_DAYS = 30;
const RECENT_ACTIVITY_LIMIT = 5;

function formatRelativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  const diffMs = Date.now() - then;
  const minutes = Math.round(diffMs / 60_000);

  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

export default function OverviewPage() {
  const summaryQuery = useQuery({ queryKey: ['stats', 'summary'], queryFn: fetchSummary });
  const uploadsQuery = useQuery({
    queryKey: ['stats', 'uploads', UPLOADS_WINDOW_DAYS],
    queryFn: () => fetchUploads(UPLOADS_WINDOW_DAYS),
  });
  const healthQuery = useQuery({ queryKey: ['jobs', 'health'], queryFn: fetchJobsHealth });
  const activityQuery = useQuery({
    queryKey: ['audit', 'recent'],
    queryFn: () => fetchAuditLogs({ limit: RECENT_ACTIVITY_LIMIT }),
  });

  const counts = summaryQuery.data ? tileCounts(summaryQuery.data) : undefined;
  const filled = uploadsQuery.data ? zeroFill(uploadsQuery.data, UPLOADS_WINDOW_DAYS) : [];
  const points = uploadsQuery.data ? sparklinePoints(filled) : [];

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold text-text">Overview</h1>

      {healthQuery.data ? (
        <HealthStrip failed={healthQuery.data.failed} delayed={healthQuery.data.delayed} />
      ) : null}

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatTile label="Total assets" value={counts?.total} />
        <StatTile label="Published" value={counts?.published} />
        <StatTile label="Processing" value={counts?.processing} />
        <StatTile label="Failed" value={counts?.failed} />
      </div>

      <div className="rounded-lg border border-border bg-surface p-4">
        <p className="text-sm text-muted">Uploads, last {UPLOADS_WINDOW_DAYS} days</p>
        <div className="mt-3">
          <Sparkline points={points} className="h-16 w-full" />
        </div>
      </div>

      <div className="rounded-lg border border-border bg-surface p-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-muted">Recent activity</p>
          <Link
            href="/audit"
            className="flex h-11 items-center text-sm font-medium text-text underline-offset-2 hover:underline md:h-auto"
          >
            View all
          </Link>
        </div>
        <ul className="mt-3 flex flex-col divide-y divide-border">
          {activityQuery.data?.data.length === 0 ? (
            <li className="py-3 text-sm text-subtle">No activity yet.</li>
          ) : (
            activityQuery.data?.data.map((entry) => (
              <li key={entry.id} className="flex items-center justify-between gap-3 py-3 text-sm">
                <span className="text-text">
                  {entry.action}
                  <span className="text-muted"> · {entry.entityType}</span>
                </span>
                <span className="shrink-0 text-subtle">{formatRelativeTime(entry.createdAt)}</span>
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  );
}
