'use client';

import { Pause, Play } from 'lucide-react';
import { togglePlayback, usePlayingId } from '@/lib/audio/row-player';

/** Plays a row's sound from the CDN; pressing it again, or another row's, stops it. */
export function PlayButton({ id, title, url }: { id: string; title: string; url: string }) {
  const playing = usePlayingId() === id;
  const Icon = playing ? Pause : Play;

  return (
    <button
      type="button"
      aria-label={`${playing ? 'Pause' : 'Play'} ${title}`}
      onClick={() => togglePlayback(id, url)}
      className="inline-flex size-11 shrink-0 items-center justify-center rounded-full text-muted transition-colors duration-150 ease-out hover:bg-elevated hover:text-text md:size-7"
    >
      <Icon className="size-4" aria-hidden="true" />
    </button>
  );
}
