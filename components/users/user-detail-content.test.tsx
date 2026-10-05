import { render, screen, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/api/client';
import type { UserDetail } from '@/lib/api/users';
import * as usersApi from '@/lib/api/users';
import { UserDetailContent } from './user-detail-content';

let currentSearch = '';

vi.mock('next/navigation', () => ({
  usePathname: () => '/users/u1',
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(currentSearch),
}));

vi.mock('@/lib/auth/profile', () => ({
  useProfile: () => ({ data: { id: 'a1', email: 'o@example.com', name: 'Owner', role: 'owner' }, isLoading: false }),
}));

vi.mock('@/lib/api/users', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api/users')>('@/lib/api/users');
  return { ...actual, fetchUser: vi.fn(), fetchUserLedger: vi.fn() };
});

function makeDetail(overrides: Partial<UserDetail> = {}): UserDetail {
  return {
    id: 'u1',
    email: 'ann@example.com',
    username: 'ann',
    accountStatus: 'active',
    creditBalance: 1200,
    createdAt: '2026-10-01T10:00:00Z',
    claimedAt: '2026-10-01T10:05:00Z',
    referralCode: 'ANN123',
    deletedAt: null,
    signInMethods: { google: true, email: false },
    ...overrides,
  };
}

function renderDetail() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <UserDetailContent id="u1" />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  currentSearch = '';
  vi.mocked(usersApi.fetchUserLedger).mockResolvedValue({ items: [], nextCursor: null });
});

afterEach(() => {
  vi.resetAllMocks();
});

describe('UserDetailContent', () => {
  it('shows who the user is, their balance and how they sign in', async () => {
    vi.mocked(usersApi.fetchUser).mockResolvedValue(makeDetail());
    renderDetail();

    expect(await screen.findByRole('heading', { name: 'ann' })).toBeInTheDocument();
    expect(screen.getByText('ann@example.com')).toBeInTheDocument();
    expect(screen.getByText('Active')).toBeInTheDocument();
    expect(screen.getByText('1,200')).toBeInTheDocument();
    expect(screen.getByText('ANN123')).toBeInTheDocument();
    const methods = screen.getByRole('list', { name: 'Sign-in methods' });
    expect(within(methods).getByText('Google')).toBeInTheDocument();
    expect(within(methods).queryByText('Email')).toBeNull();
    expect(usersApi.fetchUser).toHaveBeenCalledWith('u1');
  });

  it('marks a deleted account with its deletion date', async () => {
    vi.mocked(usersApi.fetchUser).mockResolvedValue(
      makeDetail({ accountStatus: 'deleted', email: null, username: null, deletedAt: '2026-10-04T09:00:00Z' }),
    );
    renderDetail();

    expect(await screen.findByRole('heading', { name: 'Not claimed yet' })).toBeInTheDocument();
    expect(screen.getByText(/Deleted on/)).toBeInTheDocument();
  });

  it('links back to the list with the search the user came from', async () => {
    currentSearch = 'q=ann';
    vi.mocked(usersApi.fetchUser).mockResolvedValue(makeDetail());
    renderDetail();

    expect(await screen.findByRole('link', { name: /Back to users/ })).toHaveAttribute('href', '/users?q=ann');
  });

  it('says so when the user does not exist', async () => {
    vi.mocked(usersApi.fetchUser).mockRejectedValue(
      new ApiError({ code: 'NOT_FOUND', message: 'User not found.', traceId: 't1' }, 404),
    );
    renderDetail();

    expect(await screen.findByText('This user does not exist')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Back to users/ })).toHaveAttribute('href', '/users');
  });
});

describe('UserDetailContent loading', () => {
  it('shows a skeleton of the header and history while the user loads', async () => {
    vi.mocked(usersApi.fetchUser).mockReturnValue(new Promise(() => {}));
    renderDetail();
    expect(await screen.findByRole('status', { name: 'Loading user' })).toBeInTheDocument();
    expect(screen.queryByText('Loading user…')).toBeNull();
  });
});
