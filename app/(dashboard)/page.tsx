'use client';

import { PageHeader } from '@/components/shell/page-header';
import { useQuery } from '@tanstack/react-query';
import { ActivityTimeline } from '@/components/overview/activity-timeline';
import { CreditsWaveform } from '@/components/overview/credits-waveform';
import { HealthStrip } from '@/components/overview/health-strip';
import { StatCards } from '@/components/overview/stat-cards';
import { UploadWaveform } from '@/components/overview/upload-waveform';
import { fetchAuditLogs } from '@/lib/api/audit';
import { creditDays, creditTotals, fetchCreditStats } from '@/lib/api/credits';
import { fetchJobsHealth, fetchSummary, fetchUploads, fetchUserStats, tileCounts, zeroFill } from '@/lib/api/stats';

const UPLOADS_WINDOW_DAYS = 30;
const RECENT_ACTIVITY_LIMIT = 6;
const CREDITS_WINDOW_DAYS = 30;
/** "This week" on the Users card. */
const USERS_WINDOW_DAYS = 7;

export default function OverviewPage() {
  const summaryQuery = useQuery({ queryKey: ['stats', 'summary'], queryFn: fetchSummary });
  const uploadsQuery = useQuery({
    queryKey: ['stats', 'uploads', UPLOADS_WINDOW_DAYS],
    queryFn: () => fetchUploads(UPLOADS_WINDOW_DAYS),
  });
  const healthQuery = useQuery({ queryKey: ['jobs', 'health'], queryFn: fetchJobsHealth });
  const creditsQuery = useQuery({
    queryKey: ['stats', 'credits', CREDITS_WINDOW_DAYS],
    queryFn: () => fetchCreditStats(CREDITS_WINDOW_DAYS),
  });
  const activityQuery = useQuery({
    queryKey: ['audit', 'recent'],
    queryFn: () => fetchAuditLogs({ limit: RECENT_ACTIVITY_LIMIT }),
  });
  const usersQuery = useQuery({
    queryKey: ['stats', 'users', USERS_WINDOW_DAYS],
    queryFn: () => fetchUserStats(USERS_WINDOW_DAYS),
  });

  const summary = summaryQuery.data;
  const users = usersQuery.data;

  return (
    <div className="flex flex-col gap-6 md:gap-8">
      <PageHeader title="Overview" />

      {healthQuery.data ? (
        <HealthStrip failed={healthQuery.data.failed} delayed={healthQuery.data.delayed} />
      ) : null}

      <StatCards
        stats={summary ? { ...tileCounts(summary), totalBytes: summary.totalBytes } : undefined}
        users={users ? { total: users.total, thisWeek: users.newInPeriod } : undefined}
        // The same 30 days the credits chart below draws, from the same request.
        credits={
          creditsQuery.data ? { ...creditTotals(creditsQuery.data), days: CREDITS_WINDOW_DAYS } : undefined
        }
      />

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

      <CreditsWaveform
        days={creditsQuery.data ? creditDays(creditsQuery.data, CREDITS_WINDOW_DAYS) : undefined}
        refreshing={creditsQuery.isFetching && creditsQuery.data !== undefined}
      />
    </div>
  );
}
