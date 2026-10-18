'use client';

import { useSyncExternalStore } from 'react';

/**
 * One shared <audio> for the asset list, so only one sound plays at a time:
 * starting another row stops the current one.
 */
let audio: HTMLAudioElement | null = null;
let playingId: string | null = null;
const listeners = new Set<() => void>();

function setPlaying(id: string | null): void {
  playingId = id;
  listeners.forEach((l) => l());
}

export function stopPlayback(): void {
  audio?.pause();
  setPlaying(null);
}

/** Plays this sound, or stops it if it is the one playing. */
export function togglePlayback(id: string, url: string): void {
  if (playingId === id) {
    stopPlayback();
    return;
  }
  if (!audio) {
    audio = new Audio();
    audio.addEventListener('ended', () => setPlaying(null));
  }
  audio.pause();
  audio.src = url;
  setPlaying(id);
  // A file the browser can't play (or a blocked request) just resets the button.
  audio.play().catch(() => {
    if (playingId === id) setPlaying(null);
  });
}

export function usePlayingId(): string | null {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => playingId,
    () => null,
  );
}
