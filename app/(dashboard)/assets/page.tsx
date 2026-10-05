import { Suspense } from 'react';
import { AssetsPageContent } from '@/components/assets/assets-page-content';
import { AssetsListSkeleton } from '@/components/assets/assets-skeleton';

// AssetsPageContent reads useSearchParams (for the URL-driven filters — see
// R8c), which forces the Client Component tree up to the nearest Suspense
// boundary to render client-side during static generation; without this
// wrapper `next build` fails with "Missing Suspense boundary with
// useSearchParams" (verified in node_modules/next/dist/docs/.../use-search-params.md).
export default function AssetsPage() {
  return (
    <Suspense fallback={<AssetsListSkeleton />}>
      <AssetsPageContent />
    </Suspense>
  );
}
