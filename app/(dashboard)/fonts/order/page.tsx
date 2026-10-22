'use client';

import { FontOrder } from '@/components/fonts/font-order';
import { LibraryHeader } from '@/components/library/library-header';
import { librarySection } from '@/lib/library/kinds';

export default function FontOrderPage() {
  return (
    <div className="flex flex-col gap-4">
      <LibraryHeader section={librarySection('font')!} />
      <FontOrder />
    </div>
  );
}
