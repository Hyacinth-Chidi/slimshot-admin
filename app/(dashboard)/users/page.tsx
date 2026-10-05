import { Suspense } from 'react';
import { UsersPageContent } from '@/components/users/users-page-content';

// UsersPageContent reads useSearchParams (the search lives in the URL, as on
// Assets and Audit), so `next build` needs a Suspense boundary above it.
export default function UsersPage() {
  return (
    <Suspense fallback={<p className="py-12 text-center text-sm text-subtle">Loading users…</p>}>
      <UsersPageContent />
    </Suspense>
  );
}
