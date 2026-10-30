import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as backupsApi from '@/lib/api/backups';
import { BACKUPS_KEY, type BackupItem } from '@/lib/api/backups';
import { formatDateTime } from '@/lib/format';
import { toast } from '@/lib/use-toast';
import { BackupList } from './backup-list';

vi.mock('@/lib/api/backups', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api/backups')>('@/lib/api/backups');
  return { ...actual, fetchBackupDownload: vi.fn(), fetchRestoreCommand: vi.fn(), deleteBackup: vi.fn() };
});
vi.mock('@/lib/use-toast', () => ({ toast: vi.fn() }));

const NEWEST: BackupItem = {
  filename: 'slimshot-20261029-031507-auto.dump',
  sizeBytes: 19_640_320,
  createdAt: '2026-10-29T03:15:07.000Z',
  trigger: 'auto',
};
const OLDER: BackupItem = {
  filename: 'slimshot-20261028-142210-manual.dump',
  sizeBytes: 2_048,
  createdAt: '2026-10-28T14:22:10.000Z',
  trigger: 'manual',
};
const COMMAND = "./deploy/scripts/restore-db.sh 'https://acct.r2.cloudflarestorage.com/slimshot-backups/postgres/x?X-Amz-Signature=abc'";

function setClipboard(value: unknown) {
  Object.defineProperty(navigator, 'clipboard', { value, configurable: true });
}

let assign: ReturnType<typeof vi.fn>;
beforeEach(() => {
  assign = vi.fn();
  vi.stubGlobal('location', { ...window.location, assign });
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetAllMocks();
  setClipboard(undefined);
});

function setup(backups: BackupItem[] = [NEWEST, OLDER], autoEnabled = true) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const invalidate = vi.spyOn(client, 'invalidateQueries');
  render(
    <QueryClientProvider client={client}>
      <BackupList backups={backups} autoEnabled={autoEnabled} />
    </QueryClientProvider>,
  );
  return { invalidate };
}

const menuFor = (backup: BackupItem) =>
  screen.getByRole('button', { name: `Actions for the backup from ${formatDateTime(backup.createdAt)}` });

async function choose(backup: BackupItem, item: string) {
  await userEvent.click(menuFor(backup));
  await userEvent.click(await screen.findByRole('menuitem', { name: item }));
}

describe('BackupList', () => {
  it('lists each backup with its date, size and type, newest first', () => {
    setup();
    const rows = screen.getAllByRole('row').slice(1);
    expect(rows.map((r) => within(r).getAllByRole('cell').slice(0, 3).map((c) => c.textContent))).toEqual([
      [formatDateTime(NEWEST.createdAt), '19 MB', 'Automatic'],
      [formatDateTime(OLDER.createdAt), '2 KB', 'Manual'],
    ]);
  });

  it('downloads through a fresh link', async () => {
    setup();
    vi.mocked(backupsApi.fetchBackupDownload).mockResolvedValue({ url: 'https://r2/x?sig', expiresAt: '2026-10-29T10:05:00Z' });

    await choose(OLDER, 'Download');

    expect(backupsApi.fetchBackupDownload).toHaveBeenCalledWith(OLDER.filename);
    await vi.waitFor(() => expect(assign).toHaveBeenCalledWith('https://r2/x?sig'));
  });

  it('says so when a download link cannot be had', async () => {
    setup();
    vi.mocked(backupsApi.fetchBackupDownload).mockRejectedValue(new Error('There is no backup with that name.'));

    await choose(OLDER, 'Download');

    await vi.waitFor(() => expect(toast).toHaveBeenCalledWith('There is no backup with that name.', 'error'));
    expect(assign).not.toHaveBeenCalled();
  });

  it('shows the restore command and copies it', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    setClipboard({ writeText });
    setup();
    vi.mocked(backupsApi.fetchRestoreCommand).mockResolvedValue({ command: COMMAND, expiresAt: '2026-10-29T11:00:00Z' });

    await choose(NEWEST, 'Copy restore command…');

    const dialog = await screen.findByRole('dialog', { name: 'Restore this backup' });
    expect(await within(dialog).findByText(COMMAND)).toBeInTheDocument();
    expect(dialog).toHaveTextContent("Valid for 1 hour. Run it in the server's folder on the VPS.");
    expect(dialog).toHaveTextContent(
      'Restoring replaces everything written since this backup; the script asks you to type RESTORE and saves a safety copy first. To try it safely first, put --check after restore-db.sh.',
    );
    fireEvent.click(within(dialog).getByRole('button', { name: 'Copy' }));
    await vi.waitFor(() => expect(writeText).toHaveBeenCalledWith(COMMAND));
    expect(await within(dialog).findByRole('button', { name: 'Copied' })).toBeInTheDocument();
  });

  it('lets the command be copied by hand where the browser offers no clipboard', async () => {
    setClipboard(undefined);
    setup();
    vi.mocked(backupsApi.fetchRestoreCommand).mockResolvedValue({ command: COMMAND, expiresAt: '2026-10-29T11:00:00Z' });

    await choose(NEWEST, 'Copy restore command…');

    const dialog = await screen.findByRole('dialog', { name: 'Restore this backup' });
    const command = await within(dialog).findByText(COMMAND);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Select the command and copy it' }));
    expect(window.getSelection()?.toString()).toBe(COMMAND);
    expect(command).toBeInTheDocument();
  });

  it('falls back to selecting when the browser refuses to copy', async () => {
    setClipboard({ writeText: vi.fn().mockRejectedValue(new Error('denied')) });
    setup();
    vi.mocked(backupsApi.fetchRestoreCommand).mockResolvedValue({ command: COMMAND, expiresAt: '2026-10-29T11:00:00Z' });

    await choose(NEWEST, 'Copy restore command…');
    const dialog = await screen.findByRole('dialog', { name: 'Restore this backup' });
    await within(dialog).findByText(COMMAND);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Copy' }));

    expect(await within(dialog).findByRole('button', { name: 'Select the command and copy it' })).toBeInTheDocument();
    expect(window.getSelection()?.toString()).toBe(COMMAND);
  });

  it('keeps the newest backup, and says why', async () => {
    setup();
    await userEvent.click(menuFor(NEWEST));
    const item = await screen.findByRole('menuitem', { name: /Delete…/ });
    expect(item).toHaveAttribute('aria-disabled', 'true');
    expect(item).toHaveTextContent("The newest backup can't be deleted");
  });

  it('deletes another after asking, by its date, then refreshes the list', async () => {
    const { invalidate } = setup();
    vi.mocked(backupsApi.deleteBackup).mockResolvedValue(undefined);

    await choose(OLDER, 'Delete…');
    const confirm = await screen.findByRole('alertdialog', {
      name: `Delete the backup from ${formatDateTime(OLDER.createdAt)}?`,
    });
    await userEvent.click(within(confirm).getByRole('button', { name: 'Delete' }));

    expect(backupsApi.deleteBackup).toHaveBeenCalledWith(OLDER.filename);
    await vi.waitFor(() => expect(toast).toHaveBeenCalledWith('Backup deleted.'));
    expect(invalidate).toHaveBeenCalledWith({ queryKey: BACKUPS_KEY });
    await vi.waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
  });

  it('cancels a delete without deleting', async () => {
    setup();
    await choose(OLDER, 'Delete…');
    const confirm = await screen.findByRole('alertdialog');
    await userEvent.click(within(confirm).getByRole('button', { name: 'Cancel' }));
    expect(backupsApi.deleteBackup).not.toHaveBeenCalled();
  });

  it('says when the first automatic backup will come, before there are any', () => {
    setup([], true);
    expect(screen.getByText('No backups yet. The first automatic one runs at 03:15 UTC.')).toBeInTheDocument();
    expect(screen.queryByRole('table')).toBeNull();
  });

  it('says only that there are none while automatic backups are off', () => {
    setup([], false);
    expect(screen.getByText('No backups yet.')).toBeInTheDocument();
  });
});
