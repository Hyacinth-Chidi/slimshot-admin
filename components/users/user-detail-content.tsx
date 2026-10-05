'use client';

import { useQuery } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ApiError } from '@/lib/api/client';
import { fetchUser } from '@/lib/api/users';
import { useProfile } from '@/lib/auth/profile';
import { CreditHistory } from './credit-history';
import { UserActions } from './user-actions';
import { UserDetailSkeleton } from './user-detail-skeleton';
import { UserHeader } from './user-header';

export function UserDetailContent({ id }: { id: string }) {
  const searchParams = useSearchParams();
  const q = searchParams.get('q') ?? '';
  const backHref = q ? `/users?${new URLSearchParams({ q })}` : '/users';

  const profile = useProfile();
  const query = useQuery({ queryKey: ['users', 'detail', id], queryFn: () => fetchUser(id) });

  const back = (
    <Link href={backHref} className="inline-flex w-fit items-center gap-1 text-sm text-muted hover:text-text">
      <ArrowLeft size={16} aria-hidden="true" />
      Back to users
    </Link>
  );

  if (query.isLoading) {
    return (
      <div className="flex flex-col gap-4 md:gap-6">
        {back}
        <UserDetailSkeleton />
      </div>
    );
  }

  if (!query.data) {
    const missing = query.error instanceof ApiError && query.error.status === 404;
    return (
      <div className="flex flex-col gap-4">
        {back}
        <div className="rounded-xl border border-border bg-surface p-4">
          <p className="text-sm text-text">
            {missing ? 'This user does not exist' : 'Could not load this user. Reload the page to try again.'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 md:gap-6">
      {back}
      <UserHeader user={query.data} />
      <UserActions user={query.data} role={profile.data?.role} />
      <CreditHistory userId={id} />
    </div>
  );
}
