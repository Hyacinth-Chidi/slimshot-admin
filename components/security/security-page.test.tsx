import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CreditSettings } from '@/lib/api/credits';
import * as creditsApi from '@/lib/api/credits';
import { SecurityPage } from './security-page';

vi.mock('next/navigation', () => ({ usePathname: () => '/system/security' }));
vi.mock('@/lib/auth/profile', () => ({ useProfile: () => ({ data: { role: 'owner' }, isLoading: false, isError: false }) }));
vi.mock('@/lib/api/credits', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api/credits')>('@/lib/api/credits');
  return { ...actual, fetchCreditSettings: vi.fn() };
});

const SETTINGS = {
  otpMaxAttempts: 5,
  otpResendCooldownSeconds: 60,
  otpPerEmailPerHour: 5,
  otpPerDevicePerHour: 10,
  otpPerIpPerHour: 20,
  disposableEmailDomains: ['mailinator.com'],
  lastChanged: { otpMaxAttempts: { at: '2026-10-27T10:00:00Z', by: { id: 'a1', email: 'owner@slimshot.dev', name: 'Owner' } } },
} as unknown as CreditSettings;

afterEach(() => {
  vi.resetAllMocks();
});

describe('SecurityPage', () => {
  it('puts the sign-in code limits and the blocked domains under System', async () => {
    vi.mocked(creditsApi.fetchCreditSettings).mockResolvedValue(SETTINGS);
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <SecurityPage />
      </QueryClientProvider>,
    );

    expect(screen.getByRole('heading', { level: 1, name: 'Sign-in security' })).toBeInTheDocument();
    expect(screen.getByText('Limits on email sign-in codes, to stop abuse.')).toBeInTheDocument();

    const codes = await screen.findByRole('region', { name: 'Sign-in codes' });
    expect(within(codes).getByLabelText('Wrong tries per code')).toHaveValue('5');
    expect(within(codes).getByText('Changed 27 Oct by owner@slimshot.dev')).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Blocked email domains' })).toHaveTextContent('mailinator.com');
  });
});
