'use client';

import { useQuery } from '@tanstack/react-query';
import { ActivityTimeline } from '@/components/overview/activity-timeline';
import { HealthStrip } from '@/components/overview/health-strip';
import { StatCards } from '@/components/overview/stat-cards';
import { UploadWaveform } from '@/components/overview/upload-waveform';
import { fetchAuditLogs } from '@/lib/api/audit';
import { fetchJobsHealth, fetchSummary, fetchUploads, tileCounts, zeroFill } from '@/lib/api/stats';

const UPLOADS_WINDOW_DAYS = 30;
const RECENT_ACTIVITY_LIMIT = 6;

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

  const summary = summaryQuery.data;

  return (
    <div className="flex flex-col gap-6 md:gap-8">
      <h1 className="text-xl font-semibold text-text">Overview</h1>

      {healthQuery.data ? (
        <HealthStrip failed={healthQuery.data.failed} delayed={healthQuery.data.delayed} />
      ) : null}

      <StatCards stats={summary ? { ...tileCounts(summary), totalBytes: summary.totalBytes } : undefined} />

      <div className="grid gap-6 md:gap-8 lg:grid-cols-3">
        {/* Stretch the chart panel to match the activity panel beside it. */}
        <div className="lg:col-span-2 [&>section]:h-full">
          <UploadWaveform
            points={uploadsQuery.data ? zeroFill(uploadsQuery.data, UPLOADS_WINDOW_DAYS) : undefined}
            refreshing={uploadsQuery.isFetching && uploadsQuery.data !== undefined}
          />
        </div>
        <div className="rounded-xl border border-border bg-surface p-4 md:p-6">
          <ActivityTimeline entries={activityQuery.data?.data} />
        </div>
      </div>
    </div>
  );
}
