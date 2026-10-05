'use client';

import { keepPreviousData, useInfiniteQuery } from '@tanstack/react-query';
import { useSearchParams } from 'next/navigation';
import { DebouncedSearchInput } from '@/components/assets/debounced-search-input';
import { Button } from '@/components/ui/button';
import { searchUsers } from '@/lib/api/users';
import { UserCard } from './user-card';
import { UserTable } from './user-table';

const PAGE_LIMIT = 20;

function usersUrl(search: string): string {
  const q = search.trim();
  return q ? `/users?${new URLSearchParams({ q })}` : '/users';
}

export function UsersPageContent() {
  const searchParams = useSearchParams();
  const q = searchParams.get('q')?.trim() ?? '';

  const query = useInfiniteQuery({
    queryKey: ['users', 'list', q],
    queryFn: ({ pageParam }) => searchUsers({ q: q || undefined, cursor: pageParam, limit: PAGE_LIMIT }),
    initialPageParam: undefined as string | undefined,
    // nextCursor sits inside data for these routes, so apiFetch keeps it.
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    placeholderData: keepPreviousData,
  });

  const users = (query.data?.pages ?? []).flatMap((page) => page.items);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold text-text">Users</h1>

      <DebouncedSearchInput value={q} buildUrl={usersUrl} placeholder="Search email or username…" />

      {query.isLoading ? (
        <p className="py-12 text-center text-sm text-subtle">Loading users…</p>
      ) : users.length === 0 ? (
        <p className="py-12 text-center text-sm text-subtle">
          {q ? `No users match "${q}"` : 'No app users yet'}
        </p>
      ) : (
        <>
          <div data-testid="users-cards" className="flex flex-col gap-2 md:hidden">
            {users.map((user) => (
              <UserCard key={user.id} user={user} q={q || undefined} />
            ))}
          </div>
          <div data-testid="users-table" className="hidden md:block">
            <UserTable users={users} q={q || undefined} />
          </div>
        </>
      )}

      {query.hasNextPage && (
        <div className="flex justify-center py-2">
          <Button
            variant="secondary"
            size="md"
            onClick={() => query.fetchNextPage()}
            disabled={query.isFetchingNextPage}
          >
            {query.isFetchingNextPage ? 'Loading…' : 'Load more'}
          </Button>
        </div>
      )}
    </div>
  );
}
