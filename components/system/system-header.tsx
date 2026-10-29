'use client';

import type { ReactNode } from 'react';
import { PageHeader, SectionTabs } from '@/components/shell/page-header';
import { useProfile } from '@/lib/auth/profile';
import { useMounted } from '@/lib/use-mounted';

const OWNER_TABS = [
  { label: 'AI providers', href: '/system/providers' },
  { label: 'Sign-in security', href: '/system/security' },
  { label: 'Backups', href: '/system/backups' },
  { label: 'Audit log', href: '/system/audit' },
];

/**
 * The top of a System page: System > title, then (on phones, which have no
 * sidebar) tabs between the System pages the role can use. The tabs depend on
 * the role, which only the browser knows, so they wait until mounted: the
 * server's HTML and the first browser render must match.
 */
export function SystemHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  /** The page's own buttons, beside the title. */
  actions?: ReactNode;
}) {
  const mounted = useMounted();
  const role = useProfile().data?.role;

  return (
    <div className="flex flex-col gap-3">
      <PageHeader crumbs={[{ label: 'System' }]} title={title} subtitle={subtitle} actions={actions} />
      {mounted && role === 'owner' && <SectionTabs label="System sections" items={OWNER_TABS} phoneOnly />}
    </div>
  );
}
