'use client';

import { useMemo, useSyncExternalStore } from 'react';

export const OPEN_SECTIONS_KEY = 'slimshot.sidebar.openSections';

const listeners = new Set<() => void>();

// As with the collapsed sidebar: storage can be blocked, and then the choice
// lives in memory for the session.
let storageUsable = true;
let memory = '[]';

/** The raw stored list, so the snapshot only changes when the choice does. */
function snapshot(): string {
  if (!storageUsable) return memory;
  try {
    return localStorage.getItem(OPEN_SECTIONS_KEY) ?? '[]';
  } catch {
    return memory;
  }
}

function parse(raw: string): string[] {
  try {
    const value: unknown = JSON.parse(raw);
    return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];
  } catch {
    return [];
  }
}

function setSectionOpen(label: string, open: boolean): void {
  const others = parse(snapshot()).filter((l) => l !== label);
  const next = JSON.stringify(open ? [...others, label] : others);
  memory = next;
  try {
    localStorage.setItem(OPEN_SECTIONS_KEY, next);
  } catch {
    storageUsable = false;
  }
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * Which foldable sidebar sections the viewer left unfolded, remembered in this
 * browser. The server snapshot is "none", so the prerendered HTML and the first
 * client render agree; a remembered choice applies right after hydration.
 */
export function useOpenSections(): [(label: string) => boolean, (label: string, open: boolean) => void] {
  const raw = useSyncExternalStore(subscribe, snapshot, () => '[]');
  const open = useMemo(() => new Set(parse(raw)), [raw]);
  return [(label) => open.has(label), setSectionOpen];
}
