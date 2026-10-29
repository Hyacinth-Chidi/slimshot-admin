'use client';

import { ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export interface Crumb {
  label: string;
  href?: string;
}

/** The same top of every page: where you are, the title, and the page's main action on the right. */
export function PageHeader({
  crumbs,
  title,
  subtitle,
  actions,
}: {
  crumbs?: Crumb[];
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      {crumbs && crumbs.length > 0 && (
        <nav aria-label="Breadcrumb">
          <ol className="flex flex-wrap items-center gap-1 text-xs text-subtle">
            {crumbs.map((crumb, i) => (
              <li key={`${crumb.label}-${i}`} className="flex items-center gap-1">
                {i > 0 && <ChevronRight size={12} aria-hidden="true" />}
                {crumb.href ? (
                  <Link href={crumb.href} className="hover:text-text">
                    {crumb.label}
                  </Link>
                ) : (
                  <span>{crumb.label}</span>
                )}
              </li>
            ))}
          </ol>
        </nav>
      )}
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="truncate text-xl font-semibold text-text">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}

export interface SectionTab {
  label: string;
  href: string;
}

/**
 * Tabs that are pages: each is a link, and the current one is marked.
 * `phoneOnly` is for tabs that repeat the sidebar: on desktop the sidebar is enough.
 */
export function SectionTabs({ label, items, phoneOnly = false }: { label: string; items: SectionTab[]; phoneOnly?: boolean }) {
  const pathname = usePathname();
  return (
    <nav aria-label={label} className={cn('flex gap-1 overflow-x-auto border-b border-border', phoneOnly && 'md:hidden')}>
      {items.map((tab) => {
        const current = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={current ? 'page' : undefined}
            className={cn(
              '-mb-px flex h-11 shrink-0 items-center border-b-2 px-3 text-sm font-medium transition-colors duration-150 ease-out md:h-9',
              current ? 'border-[var(--brand-from)] text-text' : 'border-transparent text-muted hover:text-text',
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
