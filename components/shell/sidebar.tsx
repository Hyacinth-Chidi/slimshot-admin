'use client';

import { ChevronRight, LogOut, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/cn';
import { useOpenSections } from '@/lib/use-open-sections';
import { useSidebarCollapsed } from '@/lib/use-sidebar-collapsed';
import { BrandLogo } from './brand-logo';
import { performLogout } from './logout-button';
import { isActive, type NavGroup, type NavItem } from './nav-items';
import { useNav } from './use-nav';

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

function SidebarLink({ item, active, collapsed }: { item: NavItem; active: boolean; collapsed: boolean }) {
  return (
    <RailTooltip label={item.label} show={collapsed}>
      <Link
        href={item.href}
        aria-label={collapsed ? item.label : undefined}
        data-testid={active ? 'nav-active' : undefined}
        aria-current={active ? 'page' : undefined}
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
}

/**
 * A section whose heading folds it. It shows unfolded when the viewer left it so,
 * or when the current page is inside it (unless they folded it on this very page),
 * so the page you're on is never hidden.
 */
function FoldableGroup({ group, label, pathname }: { group: NavGroup; label: string; pathname: string }) {
  const [isOpen, setSectionOpen] = useOpenSections();
  // The page the viewer folded this section on: it stays folded there, and opens again elsewhere.
  const [foldedOn, setFoldedOn] = useState<string | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const holdsCurrentPage = group.items.some((item) => isActive(item.href, pathname));
  const open = isOpen(label) || (holdsCurrentPage && foldedOn !== pathname);

  const onOpenChange = (next: boolean) => {
    setSectionOpen(label, next);
    setFoldedOn(next || !holdsCurrentPage ? null : pathname);
    // On a short window the unfolded pages land below the menu's visible part: bring them in.
    if (next) requestAnimationFrame(() => contentRef.current?.scrollIntoView({ block: 'nearest' }));
  };

  return (
    <Collapsible open={open} onOpenChange={onOpenChange} className="flex flex-col gap-1">
      <CollapsibleTrigger
        className={cn(
          'group flex items-center justify-between rounded-md px-3 pb-1 text-xs font-medium uppercase tracking-wide text-subtle',
          'transition-colors duration-150 ease-out hover:text-text',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-from)]',
        )}
      >
        {label}
        <ChevronRight
          size={14}
          aria-hidden="true"
          className="transition-transform duration-150 ease-out group-data-[state=open]:rotate-90"
        />
      </CollapsibleTrigger>
      <CollapsibleContent ref={contentRef} className="flex flex-col gap-1">
        {group.items.map((item) => (
          <SidebarLink key={item.href} item={item} active={isActive(item.href, pathname)} collapsed={false} />
        ))}
      </CollapsibleContent>
    </Collapsible>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const [collapsed, toggle] = useSidebarCollapsed();
  const { groups } = useNav();

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

  // On a window too short for the whole menu, the current page could sit below its visible part.
  // Again whenever the menu changes: the Library fills in once the server's kinds arrive.
  const navRef = useRef<HTMLElement>(null);
  const menuShape = groups.map((g) => g.items.map((i) => i.href).join(',')).join('|');
  useEffect(() => {
    navRef.current?.querySelector('[aria-current="page"]')?.scrollIntoView({ block: 'nearest' });
  }, [pathname, collapsed, menuShape]);

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
        <div className={cn('mb-8 flex shrink-0 items-center', collapsed ? 'flex-col gap-3' : 'justify-between px-2')}>
          <div className="flex items-center gap-2">
            <BrandLogo named={collapsed} />
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

        {/* The menu scrolls on its own when the window is too short for it, so the
            sidebar never grows past the screen and moves with the page. The padding
            keeps focus rings inside the scroll area, which would clip them. */}
        <nav ref={navRef} className="-mx-1 flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-1 py-1" aria-label="Main">
          {groups
            .filter((group) => group.items.length > 0)
            .map((group, i) =>
              group.foldable && group.label && !collapsed ? (
                <FoldableGroup key={group.label} group={group} label={group.label} pathname={pathname} />
              ) : (
                <div key={group.label ?? i} className="flex flex-col gap-1">
                  {group.label &&
                    (collapsed ? (
                      // On the icon rail a thin rule stands in for the heading, and nothing folds.
                      <div className="mx-2 border-t border-border" aria-hidden="true" />
                    ) : (
                      <p className="px-3 pb-1 text-xs font-medium uppercase tracking-wide text-subtle">{group.label}</p>
                    ))}
                  {group.items.map((item) => (
                    <SidebarLink
                      key={item.href}
                      item={item}
                      active={isActive(item.href, pathname)}
                      collapsed={collapsed}
                    />
                  ))}
                </div>
              ),
            )}
        </nav>

        <div className="flex shrink-0 flex-col gap-1 pt-4">
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
