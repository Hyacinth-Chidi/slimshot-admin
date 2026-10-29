'use client';

import { useEffect, useId, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CalendarClock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import {
  BACKUPS_KEY,
  updateBackupSettings,
  type BackupInterval,
  type BackupSettings,
  type BackupsOverview,
} from '@/lib/api/backups';
import { cn } from '@/lib/cn';
import { toast } from '@/lib/use-toast';

const INTERVALS: { value: BackupInterval; label: string }[] = [
  { value: 1, label: 'Every day' },
  { value: 7, label: 'Every 7 days' },
  { value: 30, label: 'Every 30 days' },
];

/**
 * Automatic backups on or off, and how often. Like the Rewards cards, edits are
 * kept apart from the saved settings and only what changed is sent.
 */
export function AutoBackupCard({ settings }: { settings: BackupSettings }) {
  const queryClient = useQueryClient();
  const headingId = useId();
  const switchId = useId();
  const [edits, setEdits] = useState<Partial<BackupSettings>>({});

  const autoEnabled = edits.autoEnabled ?? settings.autoEnabled;
  const intervalDays = edits.intervalDays ?? settings.intervalDays;
  const patch: Partial<BackupSettings> = {
    ...(autoEnabled !== settings.autoEnabled ? { autoEnabled } : {}),
    ...(intervalDays !== settings.intervalDays ? { intervalDays } : {}),
  };
  const dirty = Object.keys(patch).length > 0;

  const mutation = useMutation({
    mutationFn: (changes: Partial<BackupSettings>) => updateBackupSettings(changes),
    onSuccess: async (saved) => {
      setEdits({});
      // A refetch still in flight would answer with the settings from before this save.
      await queryClient.cancelQueries({ queryKey: BACKUPS_KEY });
      queryClient.setQueryData<BackupsOverview>(BACKUPS_KEY, (old) => (old ? { ...old, settings: saved } : old));
      // The next automatic backup depends on these settings; the server works it out.
      void queryClient.invalidateQueries({ queryKey: BACKUPS_KEY });
      toast('Saved.');
    },
    onError: (error) => toast(error instanceof Error ? error.message : 'Something went wrong.', 'error'),
  });

  // Leaving the page with unsaved edits asks first.
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const undo = () => {
    setEdits({});
    mutation.reset();
  };

  return (
    <section
      aria-labelledby={headingId}
      className={cn(
        'flex flex-col rounded-xl border bg-surface transition-colors duration-150 ease-out',
        dirty ? 'border-[var(--brand-from)]/60' : 'border-border',
      )}
    >
      <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
        <h2 id={headingId} className="flex items-center gap-2 text-[15px] font-semibold text-text">
          <CalendarClock size={16} aria-hidden="true" />
          Automatic backups
        </h2>
        {dirty && (
          <span className="rounded-full border border-warning/30 bg-warning/10 px-2 py-0.5 text-xs font-medium text-warning">
            Unsaved
          </span>
        )}
      </div>

      <div className="flex flex-col gap-4 px-5 py-4">
        <div className="flex items-center justify-between gap-4">
          <label htmlFor={switchId} className="text-[15px] text-text">
            Back up automatically
          </label>
          <Switch
            id={switchId}
            checked={autoEnabled}
            onCheckedChange={(checked) => setEdits((prev) => ({ ...prev, autoEnabled: checked }))}
          />
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className={cn('text-[15px]', autoEnabled ? 'text-text' : 'text-subtle')}>How often</span>
          <Select
            value={String(intervalDays)}
            onValueChange={(v) => setEdits((prev) => ({ ...prev, intervalDays: Number(v) as BackupInterval }))}
            disabled={!autoEnabled}
          >
            <SelectTrigger className="w-40" aria-label="How often">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {INTERVALS.map((option) => (
                <SelectItem key={option.value} value={String(option.value)}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex min-h-14 items-center justify-between gap-3 border-t border-border px-5 py-3 text-xs text-subtle">
        {dirty ? (
          <Button variant="ghost" size="sm" onClick={undo} disabled={mutation.isPending}>
            Undo
          </Button>
        ) : (
          <span>Checked daily at 03:15 UTC.</span>
        )}
        <Button
          variant={dirty ? 'primary' : 'secondary'}
          size="sm"
          disabled={!dirty || mutation.isPending}
          onClick={() => mutation.mutate(patch)}
        >
          {mutation.isPending ? 'Saving…' : 'Save'}
        </Button>
      </div>
    </section>
  );
}
