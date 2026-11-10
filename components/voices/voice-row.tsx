'use client';

import { useState, type DragEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowDown, ArrowUp, GripVertical } from 'lucide-react';
import { PlayButton } from '@/components/assets/play-button';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { ApiError } from '@/lib/api/client';
import { validationSummary } from '@/lib/api/field-errors';
import { makeVoiceSample, updateVoice, voicesQueryKey, type Voice, type VoiceChange } from '@/lib/api/voices';
import { stopPlayback, togglePlayback } from '@/lib/audio/row-player';
import { toast } from '@/lib/use-toast';

/** The server's limit on a voice's name. */
const MAX_LABEL = 40;

/** A voice's sample in the dashboard's one shared player: one sound at a time. */
export const sampleKey = (id: string) => `voice:${id}`;

export function voiceError(error: unknown, fallback: string): string {
  if (error instanceof ApiError && error.status === 422) return validationSummary(error);
  return error instanceof Error ? error.message : fallback;
}

export interface RowDrag {
  draggable: boolean;
  onDragStart: () => void;
  onDragOver: (event: DragEvent) => void;
  onDrop: (event: DragEvent) => void;
  onDragEnd: () => void;
}

/**
 * One voice: its name (saved when the field is left), its sample (play, or
 * make one — the owner's provider spend), whether the app offers it, and its
 * place. A voice without a sample cannot be switched on; one that is on can
 * always be switched off.
 */
export function VoiceRow({
  voice,
  index,
  count,
  reordering,
  onMove,
  drag,
}: {
  voice: Voice;
  index: number;
  count: number;
  reordering: boolean;
  onMove: (by: -1 | 1) => void;
  drag: RowDrag;
}) {
  const queryClient = useQueryClient();
  // What the field holds while it is being edited; null shows the saved name.
  const [draft, setDraft] = useState<string | null>(null);

  const replace = (next: Voice) =>
    queryClient.setQueryData<Voice[]>(voicesQueryKey, (list) => list?.map((v) => (v.id === next.id ? next : v)));

  const update = useMutation({
    mutationFn: (change: VoiceChange) => updateVoice(voice.id, change),
    onSuccess: replace,
    onError: (error) => {
      toast(voiceError(error, 'Couldn’t save the voice.'), 'error');
      queryClient.invalidateQueries({ queryKey: voicesQueryKey });
    },
  });

  const sample = useMutation({
    mutationFn: () => makeVoiceSample(voice.id),
    onSuccess: (next) => {
      replace(next);
      // Heard at once: the new sample is what was just asked for.
      stopPlayback();
      if (next.sampleUrl) togglePlayback(sampleKey(next.id), next.sampleUrl);
    },
    onError: (error) => toast(voiceError(error, 'Couldn’t make the sample.'), 'error'),
  });

  function saveName() {
    const name = (draft ?? voice.label).trim();
    setDraft(null);
    // An empty name goes back to the saved one; an unchanged one saves nothing.
    if (!name || name === voice.label) return;
    replace({ ...voice, label: name });
    update.mutate({ label: name });
  }

  function offer(on: boolean) {
    replace({ ...voice, enabled: on });
    update.mutate({ enabled: on });
  }

  const arrow = 'h-11 w-11 p-0 md:h-8 md:w-8';

  return (
    <li
      data-testid={`voice-row-${voice.id}`}
      draggable={drag.draggable}
      onDragStart={drag.onDragStart}
      onDragOver={drag.onDragOver}
      onDrop={drag.onDrop}
      onDragEnd={drag.onDragEnd}
      className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-surface p-3"
    >
      <GripVertical className="hidden size-4 shrink-0 cursor-grab text-subtle md:block" aria-hidden="true" />
      <span className="w-6 shrink-0 text-right text-sm tabular-nums text-subtle">{index + 1}</span>

      <div className="min-w-0 flex-1 basis-40">
        <Input
          aria-label={`Name of ${voice.providerVoiceId}`}
          maxLength={MAX_LABEL}
          value={draft ?? voice.label}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={saveName}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur();
          }}
          className="h-11 md:h-9"
        />
        <p className="mt-1 truncate text-xs text-subtle">{voice.providerVoiceId}</p>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {voice.sampleUrl ? (
          <PlayButton id={sampleKey(voice.id)} title={voice.label} url={voice.sampleUrl} />
        ) : (
          <span className="text-xs text-subtle">No sample yet</span>
        )}
        <Button
          variant="secondary"
          size="sm"
          aria-label={`Make sample for ${voice.label}`}
          disabled={sample.isPending}
          onClick={() => sample.mutate()}
        >
          {sample.isPending ? 'Making…' : voice.sampleUrl ? 'New sample' : 'Make sample'}
        </Button>
      </div>

      <Switch
        aria-label={`Offer ${voice.label} in the app`}
        checked={voice.enabled}
        disabled={(!voice.sampleUrl && !voice.enabled) || update.isPending}
        onCheckedChange={offer}
      />

      <div className="flex shrink-0 items-center gap-1">
        <Button
          variant="ghost"
          size="sm"
          className={arrow}
          aria-label={`Move ${voice.label} up`}
          disabled={index === 0 || reordering}
          onClick={() => onMove(-1)}
        >
          <ArrowUp className="size-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className={arrow}
          aria-label={`Move ${voice.label} down`}
          disabled={index === count - 1 || reordering}
          onClick={() => onMove(1)}
        >
          <ArrowDown className="size-4" />
        </Button>
      </div>
    </li>
  );
}
