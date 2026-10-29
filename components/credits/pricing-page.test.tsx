import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CreditSettings, PricingRule } from '@/lib/api/credits';
import * as creditsApi from '@/lib/api/credits';
import { PricingPage } from './pricing-page';

vi.mock('next/navigation', () => ({ usePathname: () => '/credits/pricing' }));
vi.mock('@/lib/api/credits', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api/credits')>('@/lib/api/credits');
  return {
    ...actual,
    fetchPricingRules: vi.fn(),
    fetchCreditSettings: vi.fn(),
    fetchCreditStats: vi.fn(),
    createPricingRule: vi.fn(),
    activatePricingRule: vi.fn(),
  };
});
vi.mock('@/lib/use-toast', () => ({ toast: vi.fn() }));

const OWNER = { id: 'a1', email: 'owner@slimshot.dev', name: 'Owner' };

function rule(overrides: Partial<PricingRule>): PricingRule {
  return {
    id: 'p3',
    feature: 'auto_captions',
    version: 3,
    mode: 'per_second',
    perJobCredits: null,
    tiers: null,
    blockSeconds: 30,
    blockCredits: 2,
    minCredits: 4,
    isActive: true,
    note: 'Cheaper for short clips',
    createdById: 'a1',
    createdBy: OWNER,
    createdAt: '2026-10-23T09:00:00Z',
    activatedAt: '2026-10-23T09:00:00Z',
    ...overrides,
  };
}

const V3 = rule({});
const V2 = rule({
  id: 'p2',
  version: 2,
  mode: 'duration_tiers',
  blockSeconds: null,
  blockCredits: null,
  minCredits: null,
  tiers: [
    { upToSeconds: 60, credits: 5 },
    { upToSeconds: 180, credits: 10 },
    { upToSeconds: null, credits: 20 },
  ],
  isActive: false,
  note: null,
  activatedAt: '2026-10-09T09:00:00Z',
});
const V1 = rule({ id: 'p1', version: 1, mode: 'per_job', perJobCredits: 10, blockSeconds: null, blockCredits: null, minCredits: null, isActive: false, note: 'Launch price', activatedAt: null });

const SETTINGS = { signupBonusCredits: 100, adRewardCredits: 5 } as CreditSettings;

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <PricingPage />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.mocked(creditsApi.fetchPricingRules).mockResolvedValue([V3, V2, V1]);
  vi.mocked(creditsApi.fetchCreditSettings).mockResolvedValue(SETTINGS);
  vi.mocked(creditsApi.fetchCreditStats).mockResolvedValue([
    { day: '2026-10-28', type: 'feature_charge', granted: 0, spent: 1000 },
    { day: '2026-10-29', type: 'feature_charge', granted: 0, spent: 515 },
    { day: '2026-10-29', type: 'feature_refund', granted: 32, spent: 0 },
    { day: '2026-10-29', type: 'rewarded_ad', granted: 400, spent: 0 },
  ]);
});

afterEach(() => {
  vi.resetAllMocks();
});

const liveCard = () => screen.findByRole('region', { name: 'Auto captions' });

describe('PricingPage', () => {
  it('states the live price in words, with who set it and when', async () => {
    renderPage();
    const card = await liveCard();
    expect(within(card).getByText('Live')).toBeInTheDocument();
    expect(
      await within(card).findByText(/^Version 3 · live since 23 Oct 2026 · set by owner@slimshot\.dev$/),
    ).toBeInTheDocument();
    expect(within(card).getByText('2 credits for every 30 seconds started · never less than 4 credits')).toBeInTheDocument();
    expect(creditsApi.fetchPricingRules).toHaveBeenCalledWith('auto_captions');
  });

  it('shows what each clip length costs', async () => {
    renderPage();
    const costs = await screen.findByRole('list', { name: 'What a clip costs' });
    expect(within(costs).getAllByRole('listitem').map((li) => li.textContent)).toEqual([
      '15 s4 cr',
      '30 s4 cr',
      '1 min4 cr',
      '3 min12 cr',
      '5 min20 cr',
      '10 min40 cr',
    ]);
  });

  it('relates ads and the sign-up bonus to the price', async () => {
    renderPage();
    expect(
      await screen.findByText(
        'One rewarded ad (5 credits) pays for up to 1 min of captions. The 100-credit sign-up bonus covers 25 min.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Change what users earn →' })).toHaveAttribute('href', '/credits/earning');
  });

  it('sums the last 30 days of charges and refunds', async () => {
    renderPage();
    expect(await screen.findByText('Last 30 days: 1,515 credits charged · 32 refunded for failed jobs')).toBeInTheDocument();
    expect(creditsApi.fetchCreditStats).toHaveBeenCalledWith(30);
  });

  it('warns and offers "Set a price" when nothing is live', async () => {
    vi.mocked(creditsApi.fetchPricingRules).mockResolvedValue([{ ...V3, isActive: false }]);
    renderPage();
    expect(await screen.findByText('No price is live, so Auto captions is off in the app.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Set a price' })).toBeInTheDocument();
    expect(screen.queryByRole('list', { name: 'What a clip costs' })).toBeNull();
  });

  it('lists every version with when it was made live', async () => {
    renderPage();
    const table = await screen.findByRole('table', { name: 'Price history' });
    const rows = within(table).getAllByRole('row').slice(1);
    expect(rows).toHaveLength(3);
    expect(rows[0]).toHaveTextContent('v3');
    expect(within(rows[0]).getByText('Live')).toBeInTheDocument();
    expect(rows[1]).toHaveTextContent('5 credits up to 1 min · 10 up to 3 min · 20 for anything longer');
    expect(rows[1]).toHaveTextContent('9 Oct 2026');
    expect(rows[1]).toHaveTextContent('—');
    expect(rows[2]).toHaveTextContent('Launch price');
    expect(rows[2]).toHaveTextContent('Never live');
  });

  it('offers "Make live again…" only for versions live before, and nothing to make live on the live one', async () => {
    renderPage();
    await screen.findByRole('table', { name: 'Price history' });
    expect(screen.queryByRole('button', { name: 'Actions for v3' })).toBeNull();

    await userEvent.click(screen.getByRole('button', { name: 'Actions for v2' }));
    expect(await screen.findByRole('menuitem', { name: 'Make live again…' })).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');

    await userEvent.click(screen.getByRole('button', { name: 'Actions for v1' }));
    expect(await screen.findByRole('menuitem', { name: 'Make live…' })).toBeInTheDocument();
  });

  it('asks before making a history version live', async () => {
    renderPage();
    await screen.findByRole('table', { name: 'Price history' });
    await userEvent.click(screen.getByRole('button', { name: 'Actions for v2' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Make live again…' }));
    expect(await screen.findByRole('alertdialog', { name: 'Make v2 live again?' })).toBeInTheDocument();
  });

  it('starts a new price from a history version', async () => {
    renderPage();
    await screen.findByRole('table', { name: 'Price history' });
    await userEvent.click(screen.getByRole('button', { name: 'Actions for v2' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Start a new price from this' }));

    const sheet = await screen.findByRole('dialog', { name: 'Change the Auto captions price' });
    expect(within(sheet).getByText('Filled in from v2. Saving creates v4; past charges never change.')).toBeInTheDocument();
  });

  it('opens Change price filled with the live price', async () => {
    renderPage();
    await liveCard();
    await userEvent.click(screen.getByRole('button', { name: 'Change price' }));
    const sheet = await screen.findByRole('dialog', { name: 'Change the Auto captions price' });
    expect(within(sheet).getByText(/Filled in with the live price \(v3\)/)).toBeInTheDocument();
  });
});
