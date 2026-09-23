'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/cn';
import { NAV_ITEMS } from './nav-items';

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      data-testid="bottom-nav"
      className="fixed bottom-0 left-0 right-0 z-40 flex border-t border-border bg-surface md:hidden"
    >
      {NAV_ITEMS.map((item) => {
        const active = pathname === item.href;
        return (
          <Link
            key={item.href}
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
