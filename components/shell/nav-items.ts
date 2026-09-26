import {
  FolderTree,
  LayoutDashboard,
  Music,
  ScrollText,
  Settings,
  type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

// The phone bottom bar has exactly four peers. Audit is reachable there from
// Overview rather than taking a fifth slot — five tabs on a phone makes every
// target smaller.
export const NAV_ITEMS: NavItem[] = [
  { href: '/', label: 'Overview', icon: LayoutDashboard },
  { href: '/assets', label: 'Assets', icon: Music },
  { href: '/categories', label: 'Categories', icon: FolderTree },
  { href: '/settings', label: 'Settings', icon: Settings },
];

// The desktop sidebar has room, so Audit gets its own entry there.
export const SIDEBAR_ITEMS: NavItem[] = [
  ...NAV_ITEMS,
  { href: '/audit', label: 'Audit log', icon: ScrollText },
];
