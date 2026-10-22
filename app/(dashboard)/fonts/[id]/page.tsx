'use client';

import { useParams } from 'next/navigation';
import { FontDetailContent } from '@/components/fonts/font-detail-content';

// A Client Component page reads its dynamic segment with useParams (Next 16).
export default function FontPage() {
  const { id } = useParams<{ id: string }>();
  return <FontDetailContent id={id} />;
}
