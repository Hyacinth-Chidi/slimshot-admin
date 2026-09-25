import { Suspense } from 'react';
import { AssetsPageContent } from '@/components/assets/assets-page-content';

// AssetsPageContent reads useSearchParams (for the URL-driven filters — see
// R8c), which forces the Client Component tree up to the nearest Suspense
// boundary to render client-side during static generation; without this
// wrapper `next build` fails with "Missing Suspense boundary with
// useSearchParams" (verified in node_modules/next/dist/docs/.../use-search-params.md).
export default function AssetsPage() {
  return (
    <Suspense fallback={<p className="py-12 text-center text-sm text-subtle">Loading assets…</p>}>
      <AssetsPageContent />
    </Suspense>
  );
}
