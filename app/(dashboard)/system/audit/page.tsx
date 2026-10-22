import { Suspense } from 'react';
import { AuditPageContent } from '@/components/audit/audit-page-content';
import { AuditListSkeleton } from '@/components/audit/audit-skeleton';

// The list reads useSearchParams (URL-driven filters), so `next build` needs a
// Suspense boundary above it.
export default function AuditPage() {
  return (
    <Suspense fallback={<AuditListSkeleton />}>
      <AuditPageContent />
    </Suspense>
  );
}
