import { apiFetch } from './client';
import { withRefresh } from '@/lib/auth/session';

/**
 * Wraps the server's owner-only /backups endpoints
 * (slimshot_server/src/modules/admin/admin-backups.controller.ts; the contract is
 * slimshot_server/docs/admin-backups-api.md). Backups are database dumps in the
 * server's private R2 bucket; the links below are signed and short-lived.
 */
export type BackupTrigger = 'auto' | 'manual';
export type BackupInterval = 1 | 7 | 30;

export interface BackupItem {
  filename: string;
  sizeBytes: number;
  createdAt: string;
  trigger: BackupTrigger;
}

export interface BackupSettings {
  autoEnabled: boolean;
  intervalDays: BackupInterval;
}

export interface BackupsOverview {
  configured: boolean;
  notConfiguredReason: 'no-bucket' | 'not-production' | null;
  settings: BackupSettings;
  status: {
    running: boolean;
    lastRunAt: string | null;
    lastRunOk: boolean | null;
    lastRunError: string | null;
    lastRunTrigger: BackupTrigger | null;
    nextAutoAt: string | null;
  };
  /** Newest first. */
  backups: BackupItem[];
}

export const BACKUPS_KEY = ['backups'] as const;

const path = (filename: string) => `/backups/${encodeURIComponent(filename)}`;

export function fetchBackups(): Promise<BackupsOverview> {
  return withRefresh(() => apiFetch<BackupsOverview>('/backups'));
}

export function updateBackupSettings(patch: Partial<BackupSettings>): Promise<BackupSettings> {
  return withRefresh(() =>
    apiFetch<BackupSettings>('/backups/settings', { method: 'PUT', body: JSON.stringify(patch) }),
  );
}

/** Queues a backup; it runs in the background, and the overview says when it ends. */
export function startBackup(): Promise<{ started: true }> {
  return withRefresh(() => apiFetch<{ started: true }>('/backups', { method: 'POST' }));
}

/** A link that downloads the backup under its own name. It lasts 5 minutes: use it at once. */
export function fetchBackupDownload(filename: string): Promise<{ url: string; expiresAt: string }> {
  return withRefresh(() => apiFetch<{ url: string; expiresAt: string }>(`${path(filename)}/download`));
}

/** The command that restores this backup on the VPS. Its link lasts an hour. */
export function fetchRestoreCommand(filename: string): Promise<{ command: string; expiresAt: string }> {
  return withRefresh(() => apiFetch<{ command: string; expiresAt: string }>(`${path(filename)}/restore-command`));
}

export function deleteBackup(filename: string): Promise<void> {
  return withRefresh(() => apiFetch<void>(path(filename), { method: 'DELETE' }));
}
