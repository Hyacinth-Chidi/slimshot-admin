import { LayoutDashboard, Music, FolderTree, Settings, type LucideIcon } from 'lucide-react';

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

// Exactly four peers. Audit is reachable from Overview rather than taking a
// fifth slot — five tabs on a phone makes every target smaller.
export const NAV_ITEMS: NavItem[] = [
  { href: '/', label: 'Overview', icon: LayoutDashboard },
  { href: '/assets', label: 'Assets', icon: Music },
  { href: '/categories', label: 'Categories', icon: FolderTree },
  { href: '/settings', label: 'Settings', icon: Settings },
];
