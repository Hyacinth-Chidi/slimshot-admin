import { FolderTree, LayoutDashboard, Music, ScrollText, type LucideIcon } from 'lucide-react';

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

// Four peers on both the phone bottom bar and the desktop sidebar. There is
// no Settings page: server configuration lives in the server's .env.
export const NAV_ITEMS: NavItem[] = [
  { href: '/', label: 'Overview', icon: LayoutDashboard },
  { href: '/assets', label: 'Assets', icon: Music },
  { href: '/categories', label: 'Categories', icon: FolderTree },
  { href: '/audit', label: 'Audit log', icon: ScrollText },
];
