'use client';

import type { ReactNode } from 'react';
import { PageHeader, SectionTabs } from '@/components/shell/page-header';
import type { LibrarySection } from '@/lib/library/kinds';

function capitalise(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

/** The top of a Library section: Library > Audio, its tabs, and the page action. */
export function LibraryHeader({ section, actions }: { section: LibrarySection; actions?: ReactNode }) {
  return (
    <div className="flex flex-col gap-3">
      <PageHeader crumbs={[{ label: 'Library' }]} title={section.label} actions={actions} />
      <SectionTabs
        label={`${section.label} sections`}
        items={[
          { label: capitalise(section.noun.many), href: section.href },
          { label: 'Categories', href: `${section.href}/categories` },
        ]}
      />
    </div>
  );
}
