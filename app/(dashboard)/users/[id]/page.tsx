'use client';

import { Suspense } from 'react';
import { useParams } from 'next/navigation';
import { UserDetailContent } from '@/components/users/user-detail-content';

// A Client Component page reads its dynamic segment with useParams (Next 16).
// The content reads useSearchParams for the Back link, hence the boundary.
export default function UserPage() {
  const { id } = useParams<{ id: string }>();

  return (
    <Suspense fallback={<p className="py-12 text-center text-sm text-subtle">Loading user…</p>}>
      <UserDetailContent id={id} />
    </Suspense>
  );
}
