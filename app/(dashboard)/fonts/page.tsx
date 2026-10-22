import { Suspense } from 'react';
import { AssetsPageContent } from '@/components/assets/assets-page-content';
import { AssetsListSkeleton } from '@/components/assets/assets-skeleton';
import { LegacyChecklist } from '@/components/fonts/legacy-checklist';

// The list reads useSearchParams (URL-driven filters), so `next build` needs a
// Suspense boundary above it.
export default function FontsPage() {
  return (
    <Suspense fallback={<AssetsListSkeleton />}>
      <AssetsPageContent kind="font" aside={<LegacyChecklist />} />
    </Suspense>
  );
}
