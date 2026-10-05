import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Page, UserSummary } from '@/lib/api/users';
import { UsersPageContent } from './users-page-content';

let currentSearch = '';
const push = vi.fn();

vi.mock('next/navigation', () => ({
  usePathname: () => '/users',
  useRouter: () => ({ push }),
  useSearchParams: () => new URLSearchParams(currentSearch),
}));

const searchUsersMock = vi.fn<(...args: unknown[]) => Promise<Page<UserSummary>>>();

vi.mock('@/lib/api/users', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api/users')>('@/lib/api/users');
  return { ...actual, searchUsers: (...args: unknown[]) => searchUsersMock(...args) };
});

function makeUser(id: string, overrides: Partial<UserSummary> = {}): UserSummary {
  return {
    id,
    email: `${id}@example.com`,
    username: id,
    accountStatus: 'active',
    creditBalance: 1200,
    createdAt: '2026-10-01T10:00:00Z',
    claimedAt: '2026-10-01T10:05:00Z',
    ...overrides,
  };
}

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <UsersPageContent />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  currentSearch = '';
  window.history.replaceState(null, '', '/users');
});

afterEach(() => {
  vi.restoreAllMocks();
  searchUsersMock.mockReset();
  push.mockReset();
});

describe('UsersPageContent', () => {
  it('shows users in a real table at md and up and as cards below md', async () => {
    searchUsersMock.mockResolvedValue({ items: [makeUser('ann')], nextCursor: null });
    renderPage();

    const table = await screen.findByTestId('users-table');
    expect(table).toHaveClass('hidden', 'md:block');
    expect(within(table).getByRole('table')).toBeInTheDocument();
    expect(within(table).getByText('ann')).toBeInTheDocument();
    expect(within(table).getByText('1,200')).toBeInTheDocument();
    expect(within(table).getByText('Active')).toBeInTheDocument();

    const cards = screen.getByTestId('users-cards');
    expect(cards).toHaveClass('md:hidden');
    expect(within(cards).getByText('ann@example.com')).toBeInTheDocument();
  });

  it('shows a deleted, never-claimed user without crashing', async () => {
    searchUsersMock.mockResolvedValue({
      items: [makeUser('x1', { username: null, email: null, accountStatus: 'deleted' })],
      nextCursor: null,
    });
    renderPage();

    const table = await screen.findByTestId('users-table');
    expect(within(table).getByText('Not claimed yet')).toBeInTheDocument();
    expect(within(table).getByText('—')).toBeInTheDocument();
    expect(within(table).getByText('Deleted')).toBeInTheDocument();
  });

  it("links each user to their page, carrying the search so Back returns to it", async () => {
    currentSearch = 'q=ann';
    searchUsersMock.mockResolvedValue({ items: [makeUser('ann')], nextCursor: null });
    renderPage();

    const cards = await screen.findByTestId('users-cards');
    expect(within(cards).getByRole('link')).toHaveAttribute('href', '/users/ann?q=ann');
  });

  it('searches with the term held in the URL', async () => {
    currentSearch = 'q=ann+lee%26co';
    searchUsersMock.mockResolvedValue({ items: [], nextCursor: null });
    renderPage();

    await waitFor(() =>
      expect(searchUsersMock).toHaveBeenCalledWith({ q: 'ann lee&co', cursor: undefined, limit: 20 }),
    );
  });

  it('writes the typed search into the URL, encoded', async () => {
    searchUsersMock.mockResolvedValue({ items: [], nextCursor: null });
    const replaceSpy = vi.spyOn(window.history, 'replaceState');
    renderPage();

    await userEvent.type(screen.getByRole('textbox', { name: 'Search' }), 'ann lee&co');
    await waitFor(() => expect(replaceSpy).toHaveBeenCalledWith(null, '', '/users?q=ann+lee%26co'));
  });

  it('says the users could not be loaded instead of claiming there are none', async () => {
    searchUsersMock.mockRejectedValue(new Error('Network down'));
    renderPage();

    expect(await screen.findByText('Couldn’t load users.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
    expect(screen.queryByText('No app users yet')).toBeNull();
  });

  it('says when there are no app users yet', async () => {
    searchUsersMock.mockResolvedValue({ items: [], nextCursor: null });
    renderPage();
    expect(await screen.findByText('No app users yet')).toBeInTheDocument();
  });

  it('says when a search matches nobody', async () => {
    currentSearch = 'q=ann';
    searchUsersMock.mockResolvedValue({ items: [], nextCursor: null });
    renderPage();
    expect(await screen.findByText('No users match "ann"')).toBeInTheDocument();
  });

  it('loads the next page with its cursor', async () => {
    searchUsersMock
      .mockResolvedValueOnce({ items: [makeUser('ann')], nextCursor: 'c1' })
      .mockResolvedValueOnce({ items: [makeUser('bob')], nextCursor: null });
    renderPage();

    await userEvent.click(await screen.findByRole('button', { name: 'Load more' }));
    const table = screen.getByTestId('users-table');
    expect(await within(table).findByText('bob')).toBeInTheDocument();
    expect(searchUsersMock).toHaveBeenLastCalledWith({ q: undefined, cursor: 'c1', limit: 20 });
    expect(screen.queryByRole('button', { name: 'Load more' })).toBeNull();
  });
});
