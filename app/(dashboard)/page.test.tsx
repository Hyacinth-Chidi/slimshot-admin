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
  sparklinePoints: () => [],
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
