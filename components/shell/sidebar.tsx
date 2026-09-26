'use client';

import { LogOut, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/cn';
import { useSidebarCollapsed } from '@/lib/use-sidebar-collapsed';
import { performLogout } from './logout-button';
import { SIDEBAR_ITEMS } from './nav-items';

const GRADIENT = 'bg-[linear-gradient(135deg,var(--brand-from)_0%,var(--brand-to)_100%)]';

/** Shows the label as a tooltip only while collapsed — expanded, it's visible already. */
function RailTooltip({ label, show, children }: { label: string; show: boolean; children: ReactNode }) {
  if (!show) return children;
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side="right">{label}</TooltipContent>
    </Tooltip>
  );
}

function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
}

export function Sidebar() {
  const pathname = usePathname();
  const [collapsed, toggle] = useSidebarCollapsed();

  // Ctrl+B / Cmd+B, the shortcut most editors and dashboards use — except while
  // typing, where it would steal the keystroke.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key.toLowerCase() !== 'b' || !(e.ctrlKey || e.metaKey) || e.altKey || e.shiftKey) return;
      if (isTyping(e.target)) return;
      e.preventDefault();
      toggle();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [toggle]);

  const toggleLabel = collapsed ? 'Expand sidebar' : 'Collapse sidebar';

  return (
    <TooltipProvider>
      <aside
        data-testid="sidebar"
        data-collapsed={collapsed}
        className={cn(
          // Sticky so navigation and Log out stay put on long pages.
          'sticky top-0 hidden h-screen shrink-0 flex-col border-r border-border bg-surface py-4 md:flex',
          'transition-[width] duration-200 ease-out',
          collapsed ? 'w-16 px-2' : 'w-60 px-4',
        )}
      >
        <div className={cn('mb-8 flex items-center', collapsed ? 'flex-col gap-3' : 'justify-between px-2')}>
          <div className="flex items-center gap-2">
            <div className={cn('h-8 w-8 shrink-0 rounded-lg', GRADIENT)} />
            {!collapsed && <span className="font-semibold">SlimShot</span>}
          </div>
          <RailTooltip label={toggleLabel} show={collapsed}>
            <button
              type="button"
              onClick={toggle}
              aria-label={toggleLabel}
              aria-expanded={!collapsed}
              title={collapsed ? undefined : `${toggleLabel} (Ctrl+B)`}
              className="flex h-8 w-8 items-center justify-center rounded-md text-muted transition-colors duration-150 ease-out hover:bg-elevated hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-from)]"
            >
              {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
            </button>
          </RailTooltip>
        </div>

        <nav className="flex flex-col gap-1">
          {SIDEBAR_ITEMS.map((item) => {
            const active = pathname === item.href;
            return (
              <RailTooltip key={item.href} label={item.label} show={collapsed}>
                <Link
                  href={item.href}
                  aria-label={collapsed ? item.label : undefined}
                  data-testid={active ? 'nav-active' : undefined}
                  className={cn(
                    'relative flex items-center gap-3 rounded-lg py-2 text-sm transition-colors duration-150 ease-out',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-from)]',
                    collapsed ? 'justify-center px-0' : 'px-3',
                    active ? 'bg-elevated text-text' : 'text-muted hover:bg-elevated hover:text-text',
                  )}
                >
                  {active && (
                    <span className={cn('absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full', GRADIENT)} />
                  )}
                  <item.icon size={18} className="shrink-0" />
                  {!collapsed && item.label}
                </Link>
              </RailTooltip>
            );
          })}
        </nav>

        <div className="mt-auto pt-4">
          <RailTooltip label="Log out" show={collapsed}>
            <button
              type="button"
              onClick={performLogout}
              aria-label={collapsed ? 'Log out' : undefined}
              className={cn(
                'flex h-9 w-full items-center gap-3 rounded-lg text-sm font-medium text-muted transition-colors duration-150 ease-out hover:bg-elevated hover:text-text',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-from)]',
                collapsed ? 'justify-center' : 'px-3',
              )}
            >
              <LogOut size={18} className="shrink-0" />
              {!collapsed && 'Log out'}
            </button>
          </RailTooltip>
        </div>
      </aside>
    </TooltipProvider>
  );
}
