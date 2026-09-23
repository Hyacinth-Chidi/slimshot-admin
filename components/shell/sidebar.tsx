'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LogOut } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Button } from '@/components/ui/button';
import { logout } from '@/lib/auth/session';
import { NAV_ITEMS } from './nav-items';

export function Sidebar() {
  const pathname = usePathname();

  async function handleLogout() {
    await logout();
    // Full navigation so no in-memory state (access token, query cache)
    // survives into the next session.
    window.location.assign('/login');
  }

  return (
    <aside
      data-testid="sidebar"
      className="hidden md:flex w-60 shrink-0 flex-col border-r border-border bg-surface p-4"
    >
      <div className="mb-8 flex items-center gap-2 px-2">
        <div className="h-8 w-8 rounded-lg bg-[linear-gradient(135deg,var(--brand-from)_0%,var(--brand-to)_100%)]" />
        <span className="font-semibold">SlimShot</span>
      </div>

      <nav className="flex flex-col gap-1">
        {NAV_ITEMS.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              data-testid={active ? 'nav-active' : undefined}
              className={cn(
                'relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors duration-150 ease-out',
                active ? 'bg-elevated text-text' : 'text-muted hover:bg-elevated hover:text-text',
              )}
            >
              {active && (
                <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-[linear-gradient(135deg,var(--brand-from)_0%,var(--brand-to)_100%)]" />
              )}
              <item.icon size={18} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto pt-4">
        <Button variant="ghost" size="sm" className="w-full justify-start" onClick={handleLogout}>
          <LogOut size={18} />
          Log out
        </Button>
      </div>
    </aside>
  );
}
