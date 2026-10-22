import { Suspense } from 'react';
import { AssetsPageContent } from '@/components/assets/assets-page-content';
import { AssetsListSkeleton } from '@/components/assets/assets-skeleton';

// The list reads useSearchParams (URL-driven filters), so `next build` needs a
// Suspense boundary above it.
export default function AudioPage() {
  return (
    <Suspense fallback={<AssetsListSkeleton />}>
      <AssetsPageContent kind="audio" />
    </Suspense>
  );
}
