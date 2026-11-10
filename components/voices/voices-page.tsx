'use client';

import Link from 'next/link';
import { useState, type DragEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { LoadingRegion, Skeleton } from '@/components/ui/skeleton';
import { ApiError } from '@/lib/api/client';
import { fetchVoices, reorderVoices, syncVoices, voicesQueryKey, type Voice } from '@/lib/api/voices';
import { cn } from '@/lib/cn';
import { toast } from '@/lib/use-toast';
import { voiceError, VoiceRow } from './voice-row';

/** `ids` with `id` moved to where `targetId` was. */
function moved(ids: string[], id: string, targetId: string): string[] {
  const next = ids.filter((x) => x !== id);
  next.splice(ids.indexOf(targetId), 0, id);
  return next;
}

function VoicesSkeleton() {
  return (
    <LoadingRegion label="Loading voices" className="flex flex-col gap-2">
      {Array.from({ length: 4 }, (_, i) => (
        <div key={i} className="flex items-center gap-3 rounded-lg border border-border bg-surface p-3">
          <Skeleton className="h-4 w-4" />
          <Skeleton className={i % 2 ? 'h-9 w-40' : 'h-9 w-52'} />
          <Skeleton className="ml-auto h-8 w-28" />
        </div>
      ))}
    </LoadingRegion>
  );
}

/**
 * The voices the app's Text to speech offers: synced from the provider
 * switched off, named, given a sample, switched on, and put in order. The
 * order is saved whole, shown at once and put back if the server refuses
 * it; moves wait for the previous save, so two saves never race.
 */
export function VoicesPage() {
  const queryClient = useQueryClient();
  const [dragId, setDragId] = useState<string | null>(null);
  // The server's own sentence when syncing cannot run (no key, switched off): a setup step, kept on screen.
  const [syncBlocked, setSyncBlocked] = useState<string | null>(null);

  const voicesQuery = useQuery({ queryKey: voicesQueryKey, queryFn: fetchVoices });

  const sync = useMutation({
    mutationFn: syncVoices,
    onMutate: () => setSyncBlocked(null),
    onSuccess: (list) => {
      const known = new Set((queryClient.getQueryData<Voice[]>(voicesQueryKey) ?? []).map((v) => v.id));
      const added = list.filter((v) => !known.has(v.id)).length;
      queryClient.setQueryData(voicesQueryKey, list);
      toast(added === 0 ? 'No new voices' : `${added} new ${added === 1 ? 'voice' : 'voices'}, switched off`);
    },
    onError: (error) => {
      if (error instanceof ApiError && error.code === 'TTS_UNAVAILABLE') setSyncBlocked(error.message);
      else toast(voiceError(error, 'Couldn’t sync the voices.'), 'error');
    },
  });

  const reorder = useMutation({
    mutationFn: (ids: string[]) => reorderVoices(ids),
    onMutate: async (ids) => {
      await queryClient.cancelQueries({ queryKey: voicesQueryKey });
      const previous = queryClient.getQueryData<Voice[]>(voicesQueryKey);
      if (previous) {
        const byId = new Map(previous.map((v) => [v.id, v]));
        queryClient.setQueryData(voicesQueryKey, ids.map((id) => byId.get(id)!));
      }
      return { previous };
    },
    onSuccess: (list) => queryClient.setQueryData(voicesQueryKey, list),
    onError: (error, _ids, context) => {
      if (context?.previous) queryClient.setQueryData(voicesQueryKey, context.previous);
      toast(voiceError(error, 'Couldn’t save the order.'), 'error');
      queryClient.invalidateQueries({ queryKey: voicesQueryKey });
    },
  });

  const voices = voicesQuery.data ?? [];
  const ids = voices.map((v) => v.id);

  function move(id: string, by: -1 | 1) {
    const target = ids[ids.indexOf(id) + by];
    if (target !== undefined) reorder.mutate(moved(ids, id, target));
  }

  function drop(targetId: string) {
    if (dragId && dragId !== targetId && !reorder.isPending) reorder.mutate(moved(ids, dragId, targetId));
    setDragId(null);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-subtle">
          The app lists the voices switched on, in this order. A voice needs a sample before it goes on.
        </p>
        <Button variant="secondary" disabled={sync.isPending} onClick={() => sync.mutate()}>
          <RefreshCw className={cn('size-4', sync.isPending && 'animate-spin')} aria-hidden="true" />
          Sync from xAI
        </Button>
      </div>

      {syncBlocked && (
        <div
          role="alert"
          className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl border border-warning/30 bg-warning/10 px-3.5 py-3 text-sm text-[#FDE68A]"
        >
          <p>{syncBlocked}</p>
          <Link href="/system/providers" className="font-medium underline-offset-2 hover:underline">
            Open AI providers
          </Link>
        </div>
      )}

      {voicesQuery.isLoading ? (
        <VoicesSkeleton />
      ) : voicesQuery.isError ? (
        <div role="alert" className="flex flex-col items-center gap-3 py-12 text-center">
          <p className="text-sm text-muted">Couldn’t load the voices.</p>
          <Button variant="secondary" onClick={() => voicesQuery.refetch()}>
            Retry
          </Button>
        </div>
      ) : voices.length === 0 ? (
        <p className="py-12 text-center text-sm text-subtle">
          No voices yet. Sync from xAI to add the provider&apos;s voices, switched off.
        </p>
      ) : (
        <ol aria-label="Voices" className="flex flex-col gap-2">
          {voices.map((voice, i) => (
            <VoiceRow
              key={voice.id}
              voice={voice}
              index={i}
              count={voices.length}
              reordering={reorder.isPending}
              onMove={(by) => move(voice.id, by)}
              drag={{
                draggable: !reorder.isPending,
                onDragStart: () => setDragId(voice.id),
                onDragOver: (e: DragEvent) => e.preventDefault(),
                onDrop: (e: DragEvent) => {
                  e.preventDefault();
                  drop(voice.id);
                },
                onDragEnd: () => setDragId(null),
              }}
            />
          ))}
        </ol>
      )}
    </div>
  );
}
