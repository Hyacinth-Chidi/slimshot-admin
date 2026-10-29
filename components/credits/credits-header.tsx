'use client';

import type { ReactNode } from 'react';
import { PageHeader, SectionTabs } from '@/components/shell/page-header';

const TABS = [
  { label: 'Pricing', href: '/credits/pricing' },
  { label: 'Earning', href: '/credits/earning' },
];

/** The top of a Credits page. The tabs repeat the sidebar, so they show on phones only. */
export function CreditsHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="flex flex-col gap-3">
      <PageHeader crumbs={[{ label: 'Credits' }]} title={title} subtitle={subtitle} actions={actions} />
      <SectionTabs label="Credits sections" items={TABS} phoneOnly />
    </div>
  );
}
