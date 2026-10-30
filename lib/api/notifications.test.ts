import { afterEach, describe, expect, it, vi } from 'vitest';
import * as client from '@/lib/api/client';
import { fetchNotifications, NOTIFICATIONS_KEY, sendNotification } from './notifications';

vi.mock('@/lib/api/client', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api/client')>('@/lib/api/client');
  return { ...actual, apiFetch: vi.fn() };
});
vi.mock('@/lib/auth/session', () => ({ withRefresh: (fn: () => unknown) => fn() }));

afterEach(() => {
  vi.resetAllMocks();
});

describe('notifications API', () => {
  it('caches the page under one key', () => {
    expect(NOTIFICATIONS_KEY).toEqual(['notifications']);
  });

  it('reads the overview', async () => {
    vi.mocked(client.apiFetch).mockResolvedValue({ configured: true, devices: 0, messages: [] });
    await fetchNotifications();
    expect(client.apiFetch).toHaveBeenCalledWith('/notifications');
  });

  it('sends a message, to everyone or to one user', async () => {
    vi.mocked(client.apiFetch).mockResolvedValue({ id: 'm1' });
    expect(await sendNotification({ title: 'Hi', body: 'There' })).toEqual({ id: 'm1' });
    expect(client.apiFetch).toHaveBeenLastCalledWith('/notifications', {
      method: 'POST',
      body: JSON.stringify({ title: 'Hi', body: 'There' }),
    });
    await sendNotification({ title: 'Hi', body: 'There', user: 'amaka@x.com' });
    expect(client.apiFetch).toHaveBeenLastCalledWith('/notifications', {
      method: 'POST',
      body: JSON.stringify({ title: 'Hi', body: 'There', user: 'amaka@x.com' }),
    });
  });
});
