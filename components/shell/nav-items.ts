import { Bot, Coins, LayoutDashboard, Library, ScrollText, Settings2, Users, type LucideIcon } from 'lucide-react';
import type { AdminRole } from '@/lib/auth/permissions';
import { librarySection } from '@/lib/library/kinds';

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

export interface NavGroup {
  /** Shown as a small heading above the group; the first group has none. */
  label?: string;
  items: NavItem[];
}

const OVERVIEW: NavItem = { href: '/', label: 'Overview', icon: LayoutDashboard };
const USERS: NavItem = { href: '/users', label: 'Users', icon: Users };
const PROVIDERS: NavItem = { href: '/system/providers', label: 'AI providers', icon: Bot };
const CREDITS: NavItem = { href: '/system/credits', label: 'Credits', icon: Coins };
const AUDIT: NavItem = { href: '/system/audit', label: 'Audit log', icon: ScrollText };

/** Providers and credits are the owner's alone (the server enforces it too). */
function systemItems(role: AdminRole | undefined): NavItem[] {
  return role === 'owner' ? [PROVIDERS, CREDITS, AUDIT] : [AUDIT];
}

/** The desktop sidebar: Overview, then the Library (one entry per kind), People and System. */
export function navGroups({ kinds, role }: { kinds: string[]; role: AdminRole | undefined }): NavGroup[] {
  const library = kinds.flatMap((kind) => {
    const section = librarySection(kind);
    return section ? [{ href: section.href, label: section.label, icon: section.icon }] : [];
  });
  return [
    { items: [OVERVIEW] },
    { label: 'Library', items: library },
    { label: 'People', items: [USERS] },
    { label: 'System', items: systemItems(role) },
  ];
}

/** A section and every page under it; Overview only on the home page itself. */
export function isActive(href: string, pathname: string): boolean {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}

export interface MobileSection extends NavItem {
  /** Sections whose pages light this tab up. */
  match: string[];
}

/** The phone's bottom bar: the four sections, each opening where the role can work. */
export function mobileSections(role: AdminRole | undefined): MobileSection[] {
  return [
    { ...OVERVIEW, match: ['/'] },
    { href: '/audio', label: 'Library', icon: Library, match: ['/audio', '/fonts'] },
    { ...USERS, match: ['/users'] },
    { href: systemItems(role)[0].href, label: 'System', icon: Settings2, match: ['/system'] },
  ];
}
