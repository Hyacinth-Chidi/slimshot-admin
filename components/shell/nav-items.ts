import { Bell, Bot, Coins, DatabaseBackup, Gift, LayoutDashboard, Library, ScrollText, Settings2, ShieldCheck, Tag, Users, type LucideIcon } from 'lucide-react';
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
  /** Its heading folds and unfolds the group. Turn it on for any group that grows long. */
  foldable?: boolean;
}

const OVERVIEW: NavItem = { href: '/', label: 'Overview', icon: LayoutDashboard };
const USERS: NavItem = { href: '/users', label: 'Users', icon: Users };
const PRICING: NavItem = { href: '/credits/pricing', label: 'Pricing', icon: Tag };
const REWARDS: NavItem = { href: '/credits/rewards', label: 'Rewards', icon: Gift };
const PROVIDERS: NavItem = { href: '/system/providers', label: 'AI providers', icon: Bot };
const SECURITY: NavItem = { href: '/system/security', label: 'Sign-in security', icon: ShieldCheck };
const BACKUPS: NavItem = { href: '/system/backups', label: 'Backups', icon: DatabaseBackup };
const NOTIFICATIONS: NavItem = { href: '/system/notifications', label: 'Notifications', icon: Bell };
const AUDIT: NavItem = { href: '/system/audit', label: 'Audit log', icon: ScrollText };

/** Providers, pricing, rewards, sign-in security and backups are the owner's alone (the server enforces it too). */
function systemItems(role: AdminRole | undefined): NavItem[] {
  return role === 'owner' ? [PROVIDERS, SECURITY, BACKUPS, NOTIFICATIONS, AUDIT] : [AUDIT];
}

/** The desktop sidebar: Overview, the Library (one entry per kind), People, Credits (owner) and System. */
export function navGroups({ kinds, role }: { kinds: string[]; role: AdminRole | undefined }): NavGroup[] {
  const library = kinds.flatMap((kind) => {
    const section = librarySection(kind);
    return section ? [{ href: section.href, label: section.label, icon: section.icon }] : [];
  });
  return [
    { items: [OVERVIEW] },
    { label: 'Library', items: library },
    { label: 'People', items: [USERS] },
    ...(role === 'owner' ? [{ label: 'Credits', items: [PRICING, REWARDS] }] : []),
    { label: 'System', items: systemItems(role), foldable: true },
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

/** The phone's bottom bar: one tab per section the role has, each opening where it can work. */
export function mobileSections(role: AdminRole | undefined): MobileSection[] {
  return [
    { ...OVERVIEW, match: ['/'] },
    { href: '/audio', label: 'Library', icon: Library, match: ['/audio', '/fonts'] },
    { ...USERS, match: ['/users'] },
    ...(role === 'owner' ? [{ href: PRICING.href, label: 'Credits', icon: Coins, match: ['/credits'] }] : []),
    { href: systemItems(role)[0].href, label: 'System', icon: Settings2, match: ['/system'] },
  ];
}
