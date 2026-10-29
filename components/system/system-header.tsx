'use client';

import { PageHeader, SectionTabs } from '@/components/shell/page-header';
import { useProfile } from '@/lib/auth/profile';
import { useMounted } from '@/lib/use-mounted';

const OWNER_TABS = [
  { label: 'AI providers', href: '/system/providers' },
  { label: 'Sign-in security', href: '/system/security' },
  { label: 'Audit log', href: '/system/audit' },
];

/**
 * The top of a System page: System > title, then (on phones, which have no
 * sidebar) tabs between the System pages the role can use. The tabs depend on
 * the role, which only the browser knows, so they wait until mounted: the
 * server's HTML and the first browser render must match.
 */
export function SystemHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  const mounted = useMounted();
  const role = useProfile().data?.role;

  return (
    <div className="flex flex-col gap-3">
      <PageHeader crumbs={[{ label: 'System' }]} title={title} subtitle={subtitle} />
      {mounted && role === 'owner' && <SectionTabs label="System sections" items={OWNER_TABS} phoneOnly />}
    </div>
  );
}
