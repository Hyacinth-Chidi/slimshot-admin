import { Suspense } from 'react';
import { UsersPageContent } from '@/components/users/users-page-content';
import { UsersListSkeleton } from '@/components/users/users-skeleton';

// UsersPageContent reads useSearchParams (the search lives in the URL, as on
// Assets and Audit), so `next build` needs a Suspense boundary above it.
export default function UsersPage() {
  return (
    <Suspense fallback={<UsersListSkeleton />}>
      <UsersPageContent />
    </Suspense>
  );
}
