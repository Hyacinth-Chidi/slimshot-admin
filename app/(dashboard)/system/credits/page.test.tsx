import { render, screen, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import CreditsPage from './page';
import type { AdminProfile } from '@/lib/auth/session';
import * as apiClient from '@/lib/api/client';
import * as creditsApi from '@/lib/api/credits';

// useProfile calls its own module-local fetchMe, which calls apiFetch
// directly, so the profile is stubbed one layer down.
vi.mock('next/navigation', () => ({ usePathname: () => currentPath }));

let currentPath = '/system/providers';

vi.mock('@/lib/api/client', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api/client')>('@/lib/api/client');
  return { ...actual, apiFetch: vi.fn() };
});

vi.mock('@/lib/api/credits', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api/credits')>('@/lib/api/credits');
  return { ...actual, fetchCreditSettings: vi.fn() };
});

function profile(role: AdminProfile['role']): AdminProfile {
  return { id: '1', email: 'a@b.com', name: 'A', role };
}

function renderWith(ui: ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  }
  return render(<>{ui}</>, { wrapper: Wrapper });
}

afterEach(() => {
  vi.resetAllMocks();
});

describe('System > Credits', () => {
  it('tells a non-owner, and never asks for credit settings', async () => {
    vi.mocked(apiClient.apiFetch).mockResolvedValue(profile('admin'));
    renderWith(<CreditsPage />);
    expect(await screen.findByText('Only the owner can manage credits.')).toBeInTheDocument();
    await new Promise((r) => setTimeout(r, 20));
    expect(creditsApi.fetchCreditSettings).not.toHaveBeenCalled();
  });

  it('gives the owner the credit rules and pricing together', async () => {
    currentPath = '/system/credits';
    vi.mocked(apiClient.apiFetch).mockResolvedValue(profile('owner'));
    vi.mocked(creditsApi.fetchCreditSettings).mockReturnValue(new Promise(() => {}));
    renderWith(<CreditsPage />);

    expect(await screen.findByRole('tab', { name: 'Rules' })).toHaveAttribute('data-state', 'active');
    expect(screen.getByRole('tab', { name: 'Pricing' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Credits' })).toBeInTheDocument();
    expect(
      within(screen.getByRole('navigation', { name: 'System sections' })).getByRole('link', { name: 'Credits' }),
    ).toHaveAttribute('aria-current', 'page');
  });
});
