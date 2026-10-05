import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { PricingRule } from '@/lib/api/credits';
import * as creditsApi from '@/lib/api/credits';
import { PricingTab } from './pricing-tab';

vi.mock('@/lib/api/credits', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api/credits')>('@/lib/api/credits');
  return { ...actual, fetchPricingRules: vi.fn(), activatePricingRule: vi.fn() };
});
vi.mock('@/lib/use-toast', () => ({ toast: vi.fn() }));

function rule(overrides: Partial<PricingRule>): PricingRule {
  return {
    id: 'r3',
    feature: 'auto_captions',
    version: 3,
    mode: 'duration_tiers',
    perJobCredits: null,
    tiers: [
      { upToSeconds: 60, credits: 2 },
      { upToSeconds: null, credits: 10 },
    ],
    isActive: true,
    note: 'October prices',
    createdById: 'a1',
    createdAt: '2026-10-01T10:00:00Z',
    activatedAt: '2026-10-01T10:01:00Z',
    ...overrides,
  };
}

function renderTab() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <PricingTab />
    </QueryClientProvider>,
  );
}

afterEach(() => {
  vi.resetAllMocks();
});

describe('PricingTab', () => {
  it('summarises the active price', async () => {
    vi.mocked(creditsApi.fetchPricingRules).mockResolvedValue([rule({})]);
    renderTab();

    const current = await screen.findByRole('region', { name: 'Current price' });
    expect(await within(current).findByText('v3 · up to 1 min → 2 credits · longer → 10')).toBeInTheDocument();
    expect(creditsApi.fetchPricingRules).toHaveBeenCalledWith('auto_captions');
  });

  it('warns when no price is active', async () => {
    vi.mocked(creditsApi.fetchPricingRules).mockResolvedValue([rule({ isActive: false })]);
    renderTab();

    expect(
      await screen.findByText('No price is active, so Auto caption is switched off in the app.'),
    ).toBeInTheDocument();
  });

  it('activates another version after confirming', async () => {
    vi.mocked(creditsApi.fetchPricingRules).mockResolvedValue([
      rule({ id: 'r4', version: 4, isActive: false, mode: 'per_job', perJobCredits: 3, tiers: null }),
      rule({}),
    ]);
    vi.mocked(creditsApi.activatePricingRule).mockResolvedValue([]);
    renderTab();

    await userEvent.click(await screen.findByRole('button', { name: 'Activate' }));
    expect(
      screen.getByText('New caption jobs will be charged at v4. Jobs already charged keep their price.'),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Activate v4' }));

    expect(creditsApi.activatePricingRule).toHaveBeenCalledWith('r4');
  });

  it('opens the new price dialog', async () => {
    vi.mocked(creditsApi.fetchPricingRules).mockResolvedValue([]);
    renderTab();

    await userEvent.click(await screen.findByRole('button', { name: 'New price' }));
    expect(screen.getByRole('heading', { name: 'New caption price' })).toBeInTheDocument();
  });
});
