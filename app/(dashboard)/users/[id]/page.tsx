'use client';

import { Suspense } from 'react';
import { useParams } from 'next/navigation';
import { UserDetailContent } from '@/components/users/user-detail-content';
import { UserDetailSkeleton } from '@/components/users/user-detail-skeleton';

// A Client Component page reads its dynamic segment with useParams (Next 16).
// The content reads useSearchParams for the Back link, hence the boundary.
export default function UserPage() {
  const { id } = useParams<{ id: string }>();

  return (
    <Suspense fallback={<UserDetailSkeleton />}>
      <UserDetailContent id={id} />
    </Suspense>
  );
}
