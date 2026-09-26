'use client';

import { useQuery } from '@tanstack/react-query';
import { ActivityTimeline } from '@/components/overview/activity-timeline';
import { HealthStrip } from '@/components/overview/health-strip';
import { LibraryFigures } from '@/components/overview/library-figures';
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

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-xl font-semibold text-text">Overview</h1>

      {healthQuery.data ? (
        <HealthStrip failed={healthQuery.data.failed} delayed={healthQuery.data.delayed} />
      ) : null}

      <UploadWaveform
        points={uploadsQuery.data ? zeroFill(uploadsQuery.data, UPLOADS_WINDOW_DAYS) : undefined}
        refreshing={uploadsQuery.isFetching && uploadsQuery.data !== undefined}
      />

      <div className="grid gap-10 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] md:gap-12">
        <LibraryFigures counts={summaryQuery.data ? tileCounts(summaryQuery.data) : undefined} />
        <ActivityTimeline entries={activityQuery.data?.data} />
      </div>
    </div>
  );
}
