'use client';

import { Suspense } from 'react';
import { useParams } from 'next/navigation';
import { AssetDetailContent } from '@/components/assets/asset-detail-content';
import { AssetDetailSkeleton } from '@/components/assets/asset-detail-skeleton';

// A Client Component page reads its dynamic segment with useParams (Next 16).
export default function AssetPage() {
  const { id } = useParams<{ id: string }>();

  return (
    <Suspense fallback={<AssetDetailSkeleton />}>
      <AssetDetailContent id={id} />
    </Suspense>
  );
}
