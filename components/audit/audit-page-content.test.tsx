import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { AuditEntry, AuditPage } from '@/lib/api/audit';
import { AuditPageContent } from './audit-page-content';

let currentSearch = '';
const push = vi.fn((url: string) => {
  currentSearch = url.includes('?') ? url.split('?')[1] : '';
});

vi.mock('next/navigation', () => ({
  usePathname: () => '/audit',
  useRouter: () => ({ push }),
  useSearchParams: () => new URLSearchParams(currentSearch),
}));

function makeEntry(id: string, overrides: Partial<AuditEntry> = {}): AuditEntry {
  return {
    id,
    actorId: 'actor1',
    actorType: 'admin',
    action: 'auth.login.succeeded',
    entityType: 'AdminUser',
    entityId: 'actor1',
    before: null,
    after: null,
    ip: '::1',
    userAgent: 'curl/8.12.1',
    createdAt: '2026-09-23T15:28:37.268Z',
    ...overrides,
  };
}

const fetchAuditLogsMock = vi.fn<(...args: unknown[]) => Promise<AuditPage>>();

vi.mock('@/lib/api/audit', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api/audit')>('@/lib/api/audit');
  return {
    ...actual,
    fetchAuditLogs: (...args: unknown[]) => fetchAuditLogsMock(...args),
  };
});

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <AuditPageContent />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  currentSearch = '';
  push.mockClear();
  fetchAuditLogsMock.mockReset();
});

describe('AuditPageContent', () => {
  it('renders entries once loaded', async () => {
    fetchAuditLogsMock.mockResolvedValue({
      data: [makeEntry('e1')],
      meta: { nextCursor: null },
    });
    renderPage();
    expect(await screen.findAllByText('auth.login.succeeded')).not.toHaveLength(0);
  });

  it('shows the distinct empty state when there are no entries and no filters', async () => {
    fetchAuditLogsMock.mockResolvedValue({ data: [], meta: { nextCursor: null } });
    renderPage();
    expect(await screen.findByText(/no audit entries yet/i)).toBeInTheDocument();
  });

  it('"Load more" calls fetchAuditLogs again with the previous page\'s meta.nextCursor', async () => {
    fetchAuditLogsMock
      .mockResolvedValueOnce({ data: [makeEntry('e1')], meta: { nextCursor: 'cursor-2' } })
      .mockResolvedValueOnce({ data: [makeEntry('e2')], meta: { nextCursor: null } });

    const user = userEvent.setup();
    renderPage();

    await screen.findAllByText('e1', { exact: false }).catch(() => undefined);
    await screen.findAllByText('auth.login.succeeded');

    const loadMoreButtons = await screen.findAllByRole('button', { name: /load more/i });
    await user.click(loadMoreButtons[0]);

    await screen.findByText((_, node) => node?.textContent === 'e2' || false).catch(() => undefined);

    expect(fetchAuditLogsMock).toHaveBeenLastCalledWith(
      expect.objectContaining({ cursor: 'cursor-2' }),
    );
  });

  it('does not render any delete/remove affordance anywhere on the page', async () => {
    fetchAuditLogsMock.mockResolvedValue({
      data: [makeEntry('e1')],
      meta: { nextCursor: null },
    });
    renderPage();
    await screen.findAllByText('auth.login.succeeded');
    expect(screen.queryByRole('button', { name: /delete|remove/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: /delete|remove/i })).not.toBeInTheDocument();
  });
});
