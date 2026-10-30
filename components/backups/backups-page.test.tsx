import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as backupsApi from '@/lib/api/backups';
import type { BackupItem, BackupsOverview } from '@/lib/api/backups';
import { ApiError } from '@/lib/api/client';
import { formatDateTime } from '@/lib/format';
import { toast } from '@/lib/use-toast';
import { BackupsPage } from './backups-page';

vi.mock('next/navigation', () => ({ usePathname: () => '/system/backups' }));
vi.mock('@/lib/auth/profile', async () => {
  const { useQuery } = await import('@tanstack/react-query');
  // The real hook's query key, served only from the cache (no network in tests).
  return { useProfile: () => useQuery({ queryKey: ['auth', 'me'], queryFn: () => new Promise(() => {}) }) };
});
vi.mock('@/lib/api/backups', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api/backups')>('@/lib/api/backups');
  return { ...actual, fetchBackups: vi.fn(), startBackup: vi.fn() };
});
vi.mock('@/lib/use-toast', () => ({ toast: vi.fn() }));

afterEach(() => {
  vi.useRealTimers();
  vi.resetAllMocks();
});

const OWNER = { id: 'a1', email: 'owner@slimshot.dev', name: 'Owner', role: 'owner' };
const AUTO: BackupItem = {
  filename: 'slimshot-20261029-031500-auto.dump',
  sizeBytes: 19_640_320,
  createdAt: '2026-10-29T03:15:00.000Z',
  trigger: 'auto',
};
const MANUAL: BackupItem = {
  filename: 'slimshot-20261029-101500-manual.dump',
  sizeBytes: 19_700_000,
  createdAt: '2026-10-29T10:15:00.000Z',
  trigger: 'manual',
};

function overview(over: Partial<BackupsOverview> = {}, status: Partial<BackupsOverview['status']> = {}): BackupsOverview {
  return {
    configured: true,
    notConfiguredReason: null,
    settings: { autoEnabled: true, intervalDays: 1 },
    backups: [AUTO],
    ...over,
    status: {
      running: false,
      lastRunAt: AUTO.createdAt,
      lastRunOk: true,
      lastRunError: null,
      lastRunTrigger: 'auto',
      nextAutoAt: '2026-10-30T03:15:00.000Z',
      ...status,
    },
  };
}

function setup(role = 'owner') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  client.setQueryData(['auth', 'me'], { ...OWNER, role });
  render(
    <QueryClientProvider client={client}>
      <BackupsPage />
    </QueryClientProvider>,
  );
  return { client };
}

const backUpNow = () => screen.queryByRole('button', { name: 'Back up now' });

describe('BackupsPage', () => {
  it('shows a skeleton until the backups load', () => {
    vi.mocked(backupsApi.fetchBackups).mockReturnValue(new Promise(() => {}));
    setup();
    expect(screen.getByRole('status', { name: 'Loading backups' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Backups' })).toBeInTheDocument();
  });

  it.each([
    ['no-bucket', "Backups are not set up yet. Add R2_BACKUP_BUCKET=slimshot-backups to the server's .env, then redeploy."],
    ['not-production', 'Backups run only on the live server.'],
  ] as const)('explains %s and offers nothing else', async (reason, text) => {
    vi.mocked(backupsApi.fetchBackups).mockResolvedValue(
      overview({ configured: false, notConfiguredReason: reason, backups: [] }, { nextAutoAt: null }),
    );
    setup();
    expect(await screen.findByText(text)).toBeInTheDocument();
    expect(screen.queryAllByRole('button')).toEqual([]);
    expect(screen.queryByRole('switch')).toBeNull();
    expect(screen.queryByRole('table')).toBeNull();
  });

  it('says when the last backup was and when the next automatic one is', async () => {
    vi.mocked(backupsApi.fetchBackups).mockResolvedValue(overview({ backups: [MANUAL, AUTO] }));
    setup();
    expect(await screen.findByText(`Last backup ${formatDateTime(MANUAL.createdAt)} · Manual`)).toBeInTheDocument();
    expect(screen.getByText(`Next automatic backup ${formatDateTime('2026-10-30T03:15:00.000Z')}`)).toBeInTheDocument();
    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: 'Back up automatically' })).toBeInTheDocument();
  });

  it('says when there is no backup yet and automatic backups are off', async () => {
    vi.mocked(backupsApi.fetchBackups).mockResolvedValue(
      overview({ backups: [], settings: { autoEnabled: false, intervalDays: 1 } }, { lastRunAt: null, lastRunOk: null, lastRunTrigger: null, nextAutoAt: null }),
    );
    setup();
    expect(await screen.findByText('No backup yet')).toBeInTheDocument();
    expect(screen.getByText('Automatic backups are off')).toBeInTheDocument();
  });

  it('warns when the last backup failed, and why', async () => {
    vi.mocked(backupsApi.fetchBackups).mockResolvedValue(
      overview({}, { lastRunOk: false, lastRunError: 'pg_dump: error: connection to server failed' }),
    );
    setup();
    expect(await screen.findByText('The last backup failed: pg_dump: error: connection to server failed')).toBeInTheDocument();
  });

  it('starts a backup, and shows it running', async () => {
    // Once started, the server reports the queued backup as running.
    vi.mocked(backupsApi.fetchBackups).mockResolvedValueOnce(overview()).mockResolvedValue(overview({}, { running: true }));
    vi.mocked(backupsApi.startBackup).mockResolvedValue({ started: true });
    setup();

    await userEvent.click(await screen.findByRole('button', { name: 'Back up now' }));

    expect(backupsApi.startBackup).toHaveBeenCalled();
    const running = await screen.findByRole('button', { name: 'Backing up…' });
    expect(running).toBeDisabled();
  });

  it('passes on why a backup could not start', async () => {
    vi.mocked(backupsApi.fetchBackups).mockResolvedValue(overview());
    vi.mocked(backupsApi.startBackup).mockRejectedValue(
      new ApiError({ code: 'CONFLICT', message: 'A backup is already running.', traceId: 't' }, 409),
    );
    setup();

    await userEvent.click(await screen.findByRole('button', { name: 'Back up now' }));

    await vi.waitFor(() => expect(toast).toHaveBeenCalledWith('A backup is already running.', 'error'));
  });

  it('polls while a backup runs, then says it finished and shows it', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.mocked(backupsApi.fetchBackups)
      .mockResolvedValueOnce(overview({}, { running: true }))
      .mockResolvedValue(overview({ backups: [MANUAL, AUTO] }, { lastRunAt: MANUAL.createdAt, lastRunTrigger: 'manual' }));
    setup();

    expect(await screen.findByRole('button', { name: 'Backing up…' })).toBeDisabled();
    await vi.advanceTimersByTimeAsync(3_000);

    await vi.waitFor(() => expect(toast).toHaveBeenCalledWith('Backup finished.'));
    expect(backupsApi.fetchBackups).toHaveBeenCalledTimes(2);
    const rows = within(screen.getByRole('table')).getAllByRole('row');
    expect(rows).toHaveLength(3);
    expect(await screen.findByRole('button', { name: 'Back up now' })).toBeEnabled();

    // Nothing runs now: no more polling.
    await vi.advanceTimersByTimeAsync(9_000);
    expect(backupsApi.fetchBackups).toHaveBeenCalledTimes(2);
  });

  it('says so when the backup it was watching failed', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.mocked(backupsApi.fetchBackups)
      .mockResolvedValueOnce(overview({}, { running: true }))
      .mockResolvedValue(overview({}, { lastRunOk: false, lastRunError: 'The database dump came out empty.' }));
    setup();

    await screen.findByRole('button', { name: 'Backing up…' });
    await vi.advanceTimersByTimeAsync(3_000);

    await vi.waitFor(() => expect(toast).toHaveBeenCalledWith('Backup failed.', 'error'));
  });

  it('keeps the page, and its unsaved edits, when a later read fails', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.mocked(backupsApi.fetchBackups)
      .mockResolvedValueOnce(overview({}, { running: true }))
      .mockRejectedValue(new Error('The server is restarting.'));
    setup();

    const toggle = await screen.findByRole('switch', { name: 'Back up automatically' });
    await userEvent.click(toggle);
    await vi.advanceTimersByTimeAsync(3_000);
    await vi.waitFor(() => expect(backupsApi.fetchBackups).toHaveBeenCalledTimes(2));

    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: 'Back up automatically' })).toHaveAttribute('aria-checked', 'false');
    expect(screen.queryByText(/Could not load the backups/)).toBeNull();
  });

  it('offers a retry when the backups never loaded', async () => {
    vi.mocked(backupsApi.fetchBackups).mockRejectedValueOnce(new Error('The server is unreachable.')).mockResolvedValue(overview());
    setup();

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Could not load the backups.');
    await userEvent.click(within(alert).getByRole('button', { name: 'Retry' }));

    expect(await screen.findByRole('table')).toBeInTheDocument();
  });

  it('follows the backup that is already running when Back up now is refused', async () => {
    vi.mocked(backupsApi.fetchBackups).mockResolvedValueOnce(overview()).mockResolvedValue(overview({}, { running: true }));
    vi.mocked(backupsApi.startBackup).mockRejectedValue(
      new ApiError({ code: 'CONFLICT', message: 'A backup is already running.', traceId: 't' }, 409),
    );
    setup();

    await userEvent.click(await screen.findByRole('button', { name: 'Back up now' }));

    await vi.waitFor(() => expect(backupsApi.fetchBackups).toHaveBeenCalledTimes(2));
    expect(await screen.findByRole('button', { name: 'Backing up…' })).toBeDisabled();
  });

  it('tells anyone but the owner, and never asks for backups', async () => {
    setup('admin');
    expect(await screen.findByText('Only the owner can manage backups.')).toBeInTheDocument();
    expect(backUpNow()).toBeNull();
    expect(backupsApi.fetchBackups).not.toHaveBeenCalled();
  });
});
