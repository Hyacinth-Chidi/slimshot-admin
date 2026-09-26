import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { ReactNode } from 'react';
import OverviewPage from './page';

vi.mock('@/lib/api/stats', () => ({
  fetchSummary: vi.fn().mockResolvedValue({ byStatus: {} }),
  fetchUploads: vi.fn().mockResolvedValue([]),
  fetchJobsHealth: vi.fn().mockResolvedValue({ waiting: 0, active: 0, failed: 0, delayed: 0 }),
  tileCounts: () => ({ total: 0, published: 0, processing: 0, failed: 0 }),
  zeroFill: (d: unknown) => d,
}));

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
  it('links "View all" to /audit', async () => {
    renderPage();
    const link = await screen.findByRole('link', { name: /view all/i });
    expect(link).toHaveAttribute('href', '/audit');
  });
});

describe('OverviewPage layout', () => {
  it('puts the stat cards above the uploads chart, then activity', async () => {
    renderPage();
    const cards = await screen.findByTestId('stat-total');
    const chart = await screen.findByRole('heading', { name: /uploads/i });
    // DOCUMENT_POSITION_FOLLOWING: the chart comes after the cards.
    expect(cards.compareDocumentPosition(chart) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    const headings = (await screen.findAllByRole('heading')).map((h) => h.textContent);
    expect(headings).toEqual(['Overview', expect.stringMatching(/uploads/i), 'Activity']);
  });
});
