import { Suspense } from 'react';
import { AuditPageContent } from '@/components/audit/audit-page-content';

// AuditPageContent reads useSearchParams (for the URL-driven filters, same
// as assets' page.tsx), which forces the Client Component tree up to the
// nearest Suspense boundary during static generation; without this wrapper
// `next build` fails with "Missing Suspense boundary with useSearchParams"
// (verified in node_modules/next/dist/docs/.../use-search-params.md).
export default function AuditPage() {
  return (
    <Suspense fallback={<p className="py-12 text-center text-sm text-subtle">Loading audit log…</p>}>
      <AuditPageContent />
    </Suspense>
  );
}
