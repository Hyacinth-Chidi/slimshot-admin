import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import type { AdminProfile } from '@/lib/auth/session';
import * as apiClient from '@/lib/api/client';
import * as settingsApi from '@/lib/api/settings';
import SettingsPage from './page';

// profile.ts's useProfile calls its own module-local fetchMe, which calls
// apiFetch directly — mocking `@/lib/auth/profile`'s export wouldn't reach
// that internal reference, so the fetch is stubbed one layer down instead.
vi.mock('@/lib/api/client', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api/client')>('@/lib/api/client');
  return { ...actual, apiFetch: vi.fn() };
});

vi.mock('@/lib/api/settings', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api/settings')>('@/lib/api/settings');
  return { ...actual, fetchSettings: vi.fn() };
});

function profile(overrides: Partial<AdminProfile> = {}): AdminProfile {
  return { id: '1', email: 'a@b.com', name: 'A', role: 'owner', ...overrides };
}

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  }
  return render(<SettingsPage />, { wrapper: Wrapper });
}

afterEach(() => {
  vi.resetAllMocks();
});

describe('SettingsPage owner gate', () => {
  it('shows a no-access panel for a non-owner and never requests settings', async () => {
    vi.mocked(apiClient.apiFetch).mockResolvedValue(profile({ role: 'admin' }));
    vi.mocked(settingsApi.fetchSettings).mockResolvedValue([]);

    renderPage();

    expect(await screen.findByText(/do not have access/i)).toBeInTheDocument();

    // Give any stray settings query a chance to fire before asserting the negative.
    await new Promise((r) => setTimeout(r, 20));
    expect(settingsApi.fetchSettings).not.toHaveBeenCalled();
  });

  it('renders settings groups for an owner', async () => {
    vi.mocked(apiClient.apiFetch).mockResolvedValue(profile({ role: 'owner' }));
    vi.mocked(settingsApi.fetchSettings).mockImplementation((group: string) =>
      Promise.resolve(
        group === 'upload'
          ? [
              {
                key: 'upload.ticketTtlSeconds',
                group: 'upload',
                type: 'int',
                isSecret: false,
                configured: true,
                description: 'TTL',
                value: 900,
              },
            ]
          : [],
      ),
    );

    renderPage();

    await waitFor(() => expect(settingsApi.fetchSettings).toHaveBeenCalledWith('upload'));
    expect(screen.queryByText(/do not have access/i)).not.toBeInTheDocument();
  });

  it('shows the mobile-only logout button to a non-owner too', async () => {
    vi.mocked(apiClient.apiFetch).mockResolvedValue(profile({ role: 'viewer' }));

    renderPage();

    await screen.findByText(/do not have access/i);
    expect(screen.getByRole('button', { name: /log out/i })).toBeInTheDocument();
  });

  it('requests exactly the server\'s four groups — upload, auth, security, infrastructure (R11c)', async () => {
    vi.mocked(apiClient.apiFetch).mockResolvedValue(profile({ role: 'owner' }));
    vi.mocked(settingsApi.fetchSettings).mockResolvedValue([]);

    renderPage();

    await waitFor(() => expect(settingsApi.fetchSettings).toHaveBeenCalledTimes(4));
    const requested = vi.mocked(settingsApi.fetchSettings).mock.calls.map(([group]) => group).sort();
    expect(requested).toEqual(['auth', 'infrastructure', 'security', 'upload']);
    expect(settingsApi.fetchSettings).not.toHaveBeenCalledWith('storage');
  });
});
