import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/api/client';
import * as api from '@/lib/api/notifications';
import type { NotificationsOverview, PushMessage } from '@/lib/api/notifications';
import { formatDateTime } from '@/lib/format';
import { toast } from '@/lib/use-toast';
import { NotificationsPage } from './notifications-page';

vi.mock('next/navigation', () => ({ usePathname: () => '/system/notifications' }));
vi.mock('@/lib/auth/profile', async () => {
  const { useQuery } = await import('@tanstack/react-query');
  return { useProfile: () => useQuery({ queryKey: ['auth', 'me'], queryFn: () => new Promise(() => {}) }) };
});
vi.mock('@/lib/api/notifications', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api/notifications')>('@/lib/api/notifications');
  return { ...actual, fetchNotifications: vi.fn(), sendNotification: vi.fn() };
});
vi.mock('@/lib/use-toast', () => ({ toast: vi.fn() }));

afterEach(() => {
  vi.useRealTimers();
  vi.resetAllMocks();
});

const SENT: PushMessage = {
  id: 'm1',
  title: 'New sounds',
  body: 'Ten new sounds are in.',
  audience: 'all',
  userId: null,
  status: 'sent',
  targetCount: 1284,
  sentCount: 1279,
  failedCount: 5,
  error: null,
  createdAt: '2026-10-30T09:00:00.000Z',
  finishedAt: '2026-10-30T09:00:04.000Z',
};
const overview = (over: Partial<NotificationsOverview> = {}): NotificationsOverview => ({
  configured: true,
  devices: 1284,
  messages: [SENT],
  ...over,
});

function setup(role = 'owner') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  client.setQueryData(['auth', 'me'], { id: 'a1', email: 'owner@slimshot.dev', name: 'Owner', role });
  render(
    <QueryClientProvider client={client}>
      <NotificationsPage />
    </QueryClientProvider>,
  );
}

const title = () => screen.getByLabelText('Title');
const message = () => screen.getByLabelText('Message');
const sendButton = () => screen.getByRole('button', { name: 'Send…' });

async function compose(t: string, m: string) {
  await userEvent.type(await screen.findByLabelText('Title'), t);
  await userEvent.type(message(), m);
}

describe('NotificationsPage', () => {
  it('shows a skeleton until it loads', () => {
    vi.mocked(api.fetchNotifications).mockReturnValue(new Promise(() => {}));
    setup();
    expect(screen.getByRole('status', { name: 'Loading notifications' })).toBeInTheDocument();
  });

  it('explains the setup, and offers nothing else, until Firebase is set up', async () => {
    vi.mocked(api.fetchNotifications).mockResolvedValue(overview({ configured: false, devices: 0, messages: [] }));
    setup();
    expect(
      await screen.findByText(
        "Push notifications are not set up yet. Add FIREBASE_SERVICE_ACCOUNT_BASE64 to the server's .env (setup guide, step 8B), then redeploy.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText('Title')).toBeNull();
    expect(screen.queryAllByRole('button')).toEqual([]);
  });

  it('sends to everyone after asking, then clears the form and refreshes the list', async () => {
    vi.mocked(api.fetchNotifications).mockResolvedValue(overview());
    vi.mocked(api.sendNotification).mockResolvedValue({ id: 'm2' });
    setup();

    await screen.findByText('1,284 installs have notifications on.');
    await compose('Fresh sounds', 'Go and have a listen.');
    await userEvent.click(sendButton());

    const confirm = await screen.findByRole('alertdialog', { name: 'Send to everyone?' });
    expect(confirm).toHaveTextContent('“Fresh sounds” goes to 1,284 installs now. It can’t be taken back.');
    await userEvent.click(within(confirm).getByRole('button', { name: 'Send' }));

    expect(api.sendNotification).toHaveBeenCalledWith({ title: 'Fresh sounds', body: 'Go and have a listen.' });
    await vi.waitFor(() => expect(toast).toHaveBeenCalledWith('Sending. The list shows when it’s done.'));
    expect(title()).toHaveValue('');
    expect(message()).toHaveValue('');
    await vi.waitFor(() => expect(api.fetchNotifications).toHaveBeenCalledTimes(2));
  });

  it('sends to one user, named by email, username or id', async () => {
    vi.mocked(api.fetchNotifications).mockResolvedValue(overview());
    vi.mocked(api.sendNotification).mockResolvedValue({ id: 'm2' });
    setup();

    await compose('Hi Amaka', 'Your credits are in.');
    await userEvent.click(screen.getByRole('combobox', { name: 'Send to' }));
    await userEvent.click(await screen.findByRole('option', { name: 'One user' }));
    await userEvent.type(screen.getByLabelText('User'), 'amaka@x.com');
    await userEvent.click(sendButton());

    const confirm = await screen.findByRole('alertdialog', { name: 'Send to amaka@x.com?' });
    await userEvent.click(within(confirm).getByRole('button', { name: 'Send' }));
    expect(api.sendNotification).toHaveBeenCalledWith({ title: 'Hi Amaka', body: 'Your credits are in.', user: 'amaka@x.com' });
  });

  it('waits for a title, a message and, for one user, who', async () => {
    vi.mocked(api.fetchNotifications).mockResolvedValue(overview());
    setup();
    await screen.findByLabelText('Title');
    expect(sendButton()).toBeDisabled();
    await compose('   ', 'x');
    expect(sendButton()).toBeDisabled();
    await userEvent.type(title(), 'Hello');
    expect(sendButton()).toBeEnabled();
    await userEvent.click(screen.getByRole('combobox', { name: 'Send to' }));
    await userEvent.click(await screen.findByRole('option', { name: 'One user' }));
    expect(sendButton()).toBeDisabled();
  });

  it('sends nothing when the confirm is cancelled', async () => {
    vi.mocked(api.fetchNotifications).mockResolvedValue(overview());
    setup();
    await compose('Hello', 'There');
    await userEvent.click(sendButton());
    await userEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Cancel' }));
    expect(api.sendNotification).not.toHaveBeenCalled();
    expect(title()).toHaveValue('Hello');
  });

  it('says why the server refused, and keeps what was written', async () => {
    vi.mocked(api.fetchNotifications).mockResolvedValue(overview());
    vi.mocked(api.sendNotification).mockRejectedValue(
      new ApiError({ code: 'PUSH_NO_RECIPIENTS', message: 'That user has no install with notifications turned on.', traceId: 't' }, 422),
    );
    setup();
    await compose('Hello', 'There');
    await userEvent.click(sendButton());
    await userEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Send' }));

    await vi.waitFor(() =>
      expect(toast).toHaveBeenCalledWith('That user has no install with notifications turned on.', 'error'),
    );
    expect(title()).toHaveValue('Hello');
  });

  it('lists what was sent, and how it went', async () => {
    const failed: PushMessage = {
      ...SENT,
      id: 'm0',
      title: 'Hi Amaka',
      audience: 'user',
      userId: 'u1',
      status: 'failed',
      targetCount: 1,
      sentCount: 0,
      failedCount: 0,
      error: 'Firebase rejected the credentials',
      createdAt: '2026-10-29T09:00:00.000Z',
    };
    vi.mocked(api.fetchNotifications).mockResolvedValue(overview({ messages: [SENT, failed] }));
    setup();

    const rows = within(await screen.findByRole('table')).getAllByRole('row').slice(1);
    expect(rows[0]).toHaveTextContent(formatDateTime(SENT.createdAt));
    expect(rows[0]).toHaveTextContent('New sounds');
    expect(rows[0]).toHaveTextContent('Everyone');
    expect(rows[0]).toHaveTextContent('1,279 of 1,284');
    expect(rows[1]).toHaveTextContent('One user');
    expect(rows[1]).toHaveTextContent('Failed: Firebase rejected the credentials');
  });

  it('says when nothing has been sent yet', async () => {
    vi.mocked(api.fetchNotifications).mockResolvedValue(overview({ messages: [] }));
    setup();
    expect(await screen.findByText('Nothing sent yet.')).toBeInTheDocument();
  });

  it('polls while a message is sending, and stops when it is done', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.mocked(api.fetchNotifications)
      .mockResolvedValueOnce(overview({ messages: [{ ...SENT, status: 'sending', sentCount: 0, failedCount: 0 }] }))
      .mockResolvedValue(overview());
    setup();

    expect(await screen.findByText('Sending…')).toBeInTheDocument();
    await vi.advanceTimersByTimeAsync(3_000);
    expect(await screen.findByText('1,279 of 1,284')).toBeInTheDocument();
    await vi.advanceTimersByTimeAsync(9_000);
    expect(api.fetchNotifications).toHaveBeenCalledTimes(2);
  });

  it('tells anyone but the owner, and never asks', async () => {
    setup('admin');
    expect(await screen.findByText('Only the owner can manage notifications.')).toBeInTheDocument();
    expect(api.fetchNotifications).not.toHaveBeenCalled();
  });
});
