'use client';

import { PageHeader, SectionTabs } from '@/components/shell/page-header';
import { useProfile } from '@/lib/auth/profile';

/**
 * The top of a System page: System > title, then tabs between the System
 * pages the role can use (so a phone, with no sidebar, can still move
 * between them). One page alone needs no tabs.
 */
export function SystemHeader({ title }: { title: string }) {
  const role = useProfile().data?.role;
  const tabs =
    role === 'owner'
      ? [
          { label: 'AI providers', href: '/system/providers' },
          { label: 'Credits', href: '/system/credits' },
          { label: 'Audit log', href: '/system/audit' },
        ]
      : [];

  return (
    <div className="flex flex-col gap-3">
      <PageHeader crumbs={[{ label: 'System' }]} title={title} />
      {tabs.length > 1 && <SectionTabs label="System sections" items={tabs} />}
    </div>
  );
}
