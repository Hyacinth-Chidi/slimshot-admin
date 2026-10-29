import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as backupsApi from '@/lib/api/backups';
import { BACKUPS_KEY, type BackupSettings, type BackupsOverview } from '@/lib/api/backups';
import { toast } from '@/lib/use-toast';
import { AutoBackupCard } from './auto-backup-card';

vi.mock('@/lib/api/backups', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api/backups')>('@/lib/api/backups');
  return { ...actual, updateBackupSettings: vi.fn() };
});
vi.mock('@/lib/use-toast', () => ({ toast: vi.fn() }));

afterEach(() => {
  vi.resetAllMocks();
});

const ON_DAILY: BackupSettings = { autoEnabled: true, intervalDays: 1 };

function overview(settings: BackupSettings): BackupsOverview {
  return {
    configured: true,
    notConfiguredReason: null,
    settings,
    status: {
      running: false,
      lastRunAt: null,
      lastRunOk: null,
      lastRunError: null,
      lastRunTrigger: null,
      nextAutoAt: null,
    },
    backups: [],
  };
}

function setup(settings = ON_DAILY) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  client.setQueryData(BACKUPS_KEY, overview(settings));
  const wrap = (ui: ReactNode) => <QueryClientProvider client={client}>{ui}</QueryClientProvider>;
  render(wrap(<AutoBackupCard settings={settings} />));
  return { client };
}

const toggle = () => screen.getByRole('switch', { name: 'Back up automatically' });
const often = () => screen.getByRole('combobox', { name: 'How often' });
const save = () => screen.getByRole('button', { name: 'Save' });

async function choose(option: string) {
  await userEvent.click(often());
  await userEvent.click(await screen.findByRole('option', { name: option }));
}

describe('AutoBackupCard', () => {
  it('shows the saved values, with nothing to save', () => {
    setup();
    expect(toggle()).toHaveAttribute('aria-checked', 'true');
    expect(often()).toHaveTextContent('Every day');
    expect(save()).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Undo' })).toBeNull();
  });

  it('turns automatic backups off, sending only that, and keeps the page in step', async () => {
    const { client } = setup();
    vi.mocked(backupsApi.updateBackupSettings).mockResolvedValue({ autoEnabled: false, intervalDays: 1 });

    await userEvent.click(toggle());
    expect(screen.getByText('Unsaved')).toBeInTheDocument();
    await userEvent.click(save());

    expect(backupsApi.updateBackupSettings).toHaveBeenCalledWith({ autoEnabled: false });
    await vi.waitFor(() => expect(toast).toHaveBeenCalledWith('Saved.'));
    expect(client.getQueryData<BackupsOverview>(BACKUPS_KEY)?.settings).toEqual({ autoEnabled: false, intervalDays: 1 });
  });

  it('changes how often, sending only the interval', async () => {
    setup();
    vi.mocked(backupsApi.updateBackupSettings).mockResolvedValue({ autoEnabled: true, intervalDays: 7 });

    await choose('Every 7 days');
    await userEvent.click(save());

    expect(backupsApi.updateBackupSettings).toHaveBeenCalledWith({ intervalDays: 7 });
  });

  it('puts the saved values back on Undo', async () => {
    setup();
    await userEvent.click(toggle());
    await userEvent.click(screen.getByRole('button', { name: 'Undo' }));

    expect(toggle()).toHaveAttribute('aria-checked', 'true');
    expect(save()).toBeDisabled();
  });

  it('has nothing to save once an edit is changed back', async () => {
    setup();
    await choose('Every 30 days');
    await choose('Every day');
    expect(save()).toBeDisabled();
  });

  it('greys out how often while automatic backups are off', async () => {
    setup({ autoEnabled: false, intervalDays: 7 });
    expect(often()).toBeDisabled();
    expect(often()).toHaveTextContent('Every 7 days');

    await userEvent.click(toggle());
    expect(often()).toBeEnabled();
  });

  it('says why a save failed, and keeps the edit', async () => {
    setup();
    vi.mocked(backupsApi.updateBackupSettings).mockRejectedValue(new Error('The server is unreachable.'));

    await userEvent.click(toggle());
    await userEvent.click(save());

    await vi.waitFor(() => expect(toast).toHaveBeenCalledWith('The server is unreachable.', 'error'));
    expect(toggle()).toHaveAttribute('aria-checked', 'false');
  });
});
