'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/cn';
import { isActive } from './nav-items';
import { useNav } from './use-nav';

/** Phones: the four sections. Each section's pages carry their own tabs. */
export function BottomNav() {
  const pathname = usePathname();
  const { sections } = useNav();

  return (
    <nav
      data-testid="bottom-nav"
      aria-label="Sections"
      className="fixed bottom-0 left-0 right-0 z-40 flex border-t border-border bg-surface md:hidden"
    >
      {sections.map((item) => {
        const active = item.match.some((prefix) => isActive(prefix, pathname));
        return (
          <Link
            key={item.label}
            href={item.href}
            data-testid={active ? 'nav-active' : undefined}
            // 44px minimum target: min-h-14 is 56px, comfortably above it.
            className={cn(
              'relative flex min-h-14 flex-1 flex-col items-center justify-center gap-1 text-xs',
              active ? 'text-text' : 'text-subtle',
            )}
          >
            {active && (
              <span className="absolute top-0 h-0.5 w-10 rounded-full bg-[linear-gradient(135deg,var(--brand-from)_0%,var(--brand-to)_100%)]" />
            )}
            <item.icon size={20} />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
