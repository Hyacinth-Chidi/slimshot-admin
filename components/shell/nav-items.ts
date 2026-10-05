import { FolderTree, LayoutDashboard, Music, ScrollText, Settings, Users, type LucideIcon } from 'lucide-react';

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

// Five peers on both the phone bottom bar and the desktop sidebar.
export const NAV_ITEMS: NavItem[] = [
  { href: '/', label: 'Overview', icon: LayoutDashboard },
  { href: '/assets', label: 'Assets', icon: Music },
  { href: '/users', label: 'Users', icon: Users },
  { href: '/categories', label: 'Categories', icon: FolderTree },
  { href: '/audit', label: 'Audit log', icon: ScrollText },
];

// Settings sits apart from the peers: at the foot of the desktop sidebar and
// as a gear in the phone top bar, so the bottom bar keeps its five tabs.
export const SETTINGS_ITEM: NavItem = { href: '/settings', label: 'Settings', icon: Settings };
