'use client';

import { useSyncExternalStore } from 'react';

export const SIDEBAR_STORAGE_KEY = 'slimshot.sidebar.collapsed';

const listeners = new Set<() => void>();

// Storage is a per-viewer convenience: it can be blocked (private mode, cleared
// site data). Once a write fails, the choice lives in memory for the session.
let storageUsable = true;
let memory = false;

function snapshot(): boolean {
  if (!storageUsable) return memory;
  try {
    return localStorage.getItem(SIDEBAR_STORAGE_KEY) === 'true';
  } catch {
    return memory;
  }
}

function toggleSidebar(): void {
  const next = !snapshot();
  memory = next;
  try {
    localStorage.setItem(SIDEBAR_STORAGE_KEY, String(next));
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
 * Whether the desktop sidebar is collapsed to its icon rail, plus a stable
 * toggle. The server snapshot is always "expanded", so the prerendered HTML and
 * the first client render agree; a remembered "collapsed" applies right after
 * hydration.
 */
export function useSidebarCollapsed(): [boolean, () => void] {
  const collapsed = useSyncExternalStore(subscribe, snapshot, () => false);
  return [collapsed, toggleSidebar];
}
