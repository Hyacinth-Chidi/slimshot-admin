import { afterEach, describe, expect, it, vi } from 'vitest';
import * as client from '@/lib/api/client';
import {
  BACKUPS_KEY,
  deleteBackup,
  fetchBackupDownload,
  fetchBackups,
  fetchRestoreCommand,
  startBackup,
  updateBackupSettings,
} from './backups';

vi.mock('@/lib/api/client', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api/client')>('@/lib/api/client');
  return { ...actual, apiFetch: vi.fn() };
});
vi.mock('@/lib/auth/session', () => ({ withRefresh: (fn: () => unknown) => fn() }));

afterEach(() => {
  vi.resetAllMocks();
});

const NAME = 'slimshot-20261029-031507-auto.dump';

describe('backups API', () => {
  it('caches the page under one key', () => {
    expect(BACKUPS_KEY).toEqual(['backups']);
  });

  it('reads the overview', async () => {
    vi.mocked(client.apiFetch).mockResolvedValue({ configured: false });
    await fetchBackups();
    expect(client.apiFetch).toHaveBeenCalledWith('/backups');
  });

  it('saves only the settings it is given, with PUT', async () => {
    vi.mocked(client.apiFetch).mockResolvedValue({ autoEnabled: true, intervalDays: 7 });
    expect(await updateBackupSettings({ intervalDays: 7 })).toEqual({ autoEnabled: true, intervalDays: 7 });
    expect(client.apiFetch).toHaveBeenCalledWith('/backups/settings', {
      method: 'PUT',
      body: JSON.stringify({ intervalDays: 7 }),
    });
  });

  it('starts a backup with POST', async () => {
    vi.mocked(client.apiFetch).mockResolvedValue({ started: true });
    await startBackup();
    expect(client.apiFetch).toHaveBeenCalledWith('/backups', { method: 'POST' });
  });

  it('asks for a download link and a restore command by name', async () => {
    vi.mocked(client.apiFetch).mockResolvedValue({ url: 'https://r2/x', expiresAt: '2026-10-29T10:05:00.000Z' });
    await fetchBackupDownload(NAME);
    expect(client.apiFetch).toHaveBeenLastCalledWith(`/backups/${NAME}/download`);
    await fetchRestoreCommand(NAME);
    expect(client.apiFetch).toHaveBeenLastCalledWith(`/backups/${NAME}/restore-command`);
  });

  it('deletes with DELETE', async () => {
    vi.mocked(client.apiFetch).mockResolvedValue(undefined);
    await deleteBackup(NAME);
    expect(client.apiFetch).toHaveBeenCalledWith(`/backups/${NAME}`, { method: 'DELETE' });
  });

  it('encodes a name, so it can never reach another route', async () => {
    vi.mocked(client.apiFetch).mockResolvedValue(undefined);
    await deleteBackup('../settings?x=1');
    expect(client.apiFetch).toHaveBeenCalledWith('/backups/..%2Fsettings%3Fx%3D1', { method: 'DELETE' });
  });
});
