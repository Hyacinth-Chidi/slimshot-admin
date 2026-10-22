'use client';

import { CategoryTree } from '@/components/categories/category-tree';
import { librarySection } from '@/lib/library/kinds';
import { LibraryHeader } from './library-header';

/** A kind's categories. With none yet, says which top-level category the app looks for. */
export function LibraryCategories({ kind }: { kind: string }) {
  const section = librarySection(kind)!;
  const roots = section.appRoots.map((r) => `"${r.name}"`).join(' or ');

  return (
    <div className="flex flex-col gap-4">
      <LibraryHeader section={section} />
      <CategoryTree
        kind={kind}
        lockKind
        emptyState={
          <div className="flex flex-col items-center gap-2 py-12 text-center">
            <p className="text-sm text-text">No categories yet.</p>
            <p className="max-w-md text-sm text-subtle">
              Create a top-level category named {roots}. The app shows its sub-categories as the pills to browse by.
            </p>
          </div>
        }
      />
    </div>
  );
}
