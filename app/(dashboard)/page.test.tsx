import { render, screen, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { ReactNode } from 'react';
import * as creditsApi from '@/lib/api/credits';
import * as statsApi from '@/lib/api/stats';
import OverviewPage from './page';

vi.mock('@/lib/api/stats', () => ({
  fetchSummary: vi.fn().mockResolvedValue({ byStatus: {} }),
  fetchUploads: vi.fn().mockResolvedValue([]),
  fetchJobsHealth: vi.fn().mockResolvedValue({ waiting: 0, active: 0, failed: 0, delayed: 0 }),
  fetchUserStats: vi.fn().mockResolvedValue({ total: 0, newInPeriod: 0 }),
  tileCounts: () => ({ total: 0, published: 0, failed: 0 }),
  zeroFill: (d: unknown) => d,
}));

vi.mock('@/lib/api/credits', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api/credits')>('@/lib/api/credits');
  return { ...actual, fetchCreditStats: vi.fn().mockResolvedValue([]) };
});

vi.mock('@/lib/api/audit', () => ({
  fetchAuditLogs: vi.fn().mockResolvedValue({ data: [], meta: { nextCursor: null } }),
}));

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  }
  return render(<OverviewPage />, { wrapper: Wrapper });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('OverviewPage recent activity', () => {
  it('links "View all" to the audit log under System', async () => {
    renderPage();
    const link = await screen.findByRole('link', { name: /view all/i });
    expect(link).toHaveAttribute('href', '/system/audit');
  });
});

describe('OverviewPage cards', () => {
  it("shows the users, and the credits spent over the chart's 30 days", async () => {
    vi.mocked(statsApi.fetchUserStats).mockResolvedValueOnce({ total: 1284, newInPeriod: 56 });
    vi.mocked(creditsApi.fetchCreditStats).mockResolvedValueOnce([
      { day: '2026-11-15', type: 'feature_charge', granted: 0, spent: 40 },
      { day: '2026-11-16', type: 'rewarded_ad', granted: 25, spent: 0 },
    ]);
    renderPage();

    const users = await screen.findByTestId('stat-users');
    expect(await within(users).findByText('1,284')).toBeInTheDocument();
    expect(within(users).getByText('+56 this week')).toBeInTheDocument();
    expect(statsApi.fetchUserStats).toHaveBeenCalledWith(7);

    const credits = screen.getByTestId('stat-credits');
    expect(await within(credits).findByText('40')).toBeInTheDocument();
    expect(within(credits).getByText('Last 30 days · 25 given')).toBeInTheDocument();
    // One request serves the card and the chart.
    expect(creditsApi.fetchCreditStats).toHaveBeenCalledTimes(1);
  });
});

describe('OverviewPage layout', () => {
  it('shows credits granted and spent over the last 30 days', async () => {
    renderPage();
    expect(await screen.findByRole('heading', { name: /credits/i })).toBeInTheDocument();
    expect(creditsApi.fetchCreditStats).toHaveBeenCalledWith(30);
  });

  it('puts the stat cards above the uploads chart, then activity, then credits', async () => {
    renderPage();
    const cards = await screen.findByTestId('stat-total');
    const chart = await screen.findByRole('heading', { name: /uploads/i });
    // DOCUMENT_POSITION_FOLLOWING: the chart comes after the cards.
    expect(cards.compareDocumentPosition(chart) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    const headings = (await screen.findAllByRole('heading')).map((h) => h.textContent);
    expect(headings).toEqual([
      'Overview',
      expect.stringMatching(/uploads/i),
      'Activity',
      expect.stringMatching(/credits/i),
    ]);
  });
});
