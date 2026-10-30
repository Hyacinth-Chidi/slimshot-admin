'use client';

import { useEffect, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { TriangleAlert } from 'lucide-react';
import { OwnerOnly } from '@/components/system/owner-only';
import { SystemHeader } from '@/components/system/system-header';
import { Button } from '@/components/ui/button';
import { LoadingRegion, Skeleton } from '@/components/ui/skeleton';
import { BACKUPS_KEY, fetchBackups, startBackup, type BackupsOverview } from '@/lib/api/backups';
import { ApiError } from '@/lib/api/client';
import { useProfile } from '@/lib/auth/profile';
import { formatDateTime } from '@/lib/format';
import { useMounted } from '@/lib/use-mounted';
import { toast } from '@/lib/use-toast';
import { AutoBackupCard } from './auto-backup-card';
import { BackupList } from './backup-list';

const NOT_CONFIGURED: Record<NonNullable<BackupsOverview['notConfiguredReason']>, string> = {
  'no-bucket': "Backups are not set up yet. Add R2_BACKUP_BUCKET=slimshot-backups to the server's .env, then redeploy.",
  'not-production': 'Backups run only on the live server.',
};

/** One query for the page and its header button. It polls every 3 s only while a backup runs. */
function useBackups() {
  return useQuery({
    queryKey: BACKUPS_KEY,
    queryFn: fetchBackups,
    refetchInterval: (query) => (query.state.data?.status.running ? 3_000 : false),
  });
}

/** System › Backups: the header outside the owner gate, everything else inside it. */
export function BackupsPage() {
  return (
    <div className="flex flex-col gap-6">
      <SystemHeader
        title="Backups"
        subtitle="Copies of the database in your private R2 bucket."
        actions={<BackUpNowAction />}
      />
      <OwnerOnly what="backups">
        <BackupsContent />
      </OwnerOnly>
    </div>
  );
}

/** The role is only known in the browser, so the button waits until mounted (as SystemHeader's tabs do). */
function BackUpNowAction() {
  const mounted = useMounted();
  const role = useProfile().data?.role;
  return mounted && role === 'owner' ? <BackUpNowButton /> : null;
}

function BackUpNowButton() {
  const queryClient = useQueryClient();
  const { data } = useBackups();
  const start = useMutation({
    mutationFn: () => startBackup(),
    onSuccess: async () => {
      // Running from now: polling starts at once, and a backup that ends before the next
      // read is still noticed finishing.
      await queryClient.cancelQueries({ queryKey: BACKUPS_KEY });
      queryClient.setQueryData<BackupsOverview>(BACKUPS_KEY, (old) =>
        old ? { ...old, status: { ...old.status, running: true } } : old,
      );
      void queryClient.invalidateQueries({ queryKey: BACKUPS_KEY });
    },
    onError: (error) => {
      if (error instanceof ApiError && error.status === 401) return;
      toast(error instanceof Error ? error.message : 'Something went wrong.', 'error');
    },
  });

  if (!data?.configured) return null;
  const running = data.status.running || start.isPending;
  return (
    <Button variant="primary" disabled={running} onClick={() => start.mutate()}>
      {running ? 'Backing up…' : 'Back up now'}
    </Button>
  );
}

function BackupsContent() {
  const query = useBackups();
  const data = query.data;

  // A backup that was running and no longer is has just ended: say how it went.
  const wasRunning = useRef<boolean | null>(null);
  useEffect(() => {
    if (!data) return;
    if (wasRunning.current && !data.status.running) {
      if (data.status.lastRunOk === false) toast('Backup failed.', 'error');
      else toast('Backup finished.');
    }
    wasRunning.current = data.status.running;
  }, [data]);

  if (query.isPending) return <BackupsSkeleton />;
  if (query.isError) {
    return <p className="text-sm text-error">Could not load the backups: {query.error.message}</p>;
  }
  if (!data) return null;

  if (!data.configured) {
    return (
      <div className="rounded-xl border border-border bg-surface p-5">
        <p className="text-sm text-text">{NOT_CONFIGURED[data.notConfiguredReason ?? 'no-bucket']}</p>
      </div>
    );
  }

  const newest = data.backups[0];
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1 text-sm text-muted md:flex-row md:gap-6">
        <p>
          {newest
            ? `Last backup ${formatDateTime(newest.createdAt)} · ${newest.trigger === 'auto' ? 'Automatic' : 'Manual'}`
            : 'No backup yet'}
        </p>
        <p>
          {data.status.nextAutoAt
            ? `Next automatic backup ${formatDateTime(data.status.nextAutoAt)}`
            : 'Automatic backups are off'}
        </p>
      </div>

      {data.status.lastRunOk === false && (
        <div className="flex items-start gap-2 rounded-xl border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning">
          <TriangleAlert size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
          <p className="break-words">{`The last backup failed: ${data.status.lastRunError ?? 'no reason was recorded.'}`}</p>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] lg:items-start">
        <AutoBackupCard settings={data.settings} />
        <BackupList backups={data.backups} autoEnabled={data.settings.autoEnabled} />
      </div>
    </div>
  );
}

function BackupsSkeleton() {
  return (
    <LoadingRegion label="Loading backups" className="flex flex-col gap-6">
      <div className="flex flex-col gap-2 md:flex-row md:gap-6">
        <Skeleton className="h-4 w-56" />
        <Skeleton className="h-4 w-60" />
      </div>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] lg:items-start">
        <Skeleton className="h-52 w-full rounded-xl" />
        <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-5 w-full" />
          ))}
        </div>
      </div>
    </LoadingRegion>
  );
}
