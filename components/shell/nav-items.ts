import { FolderTree, LayoutDashboard, Music, ScrollText, Settings, type LucideIcon } from 'lucide-react';

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

// Four peers on both the phone bottom bar and the desktop sidebar.
export const NAV_ITEMS: NavItem[] = [
  { href: '/', label: 'Overview', icon: LayoutDashboard },
  { href: '/assets', label: 'Assets', icon: Music },
  { href: '/categories', label: 'Categories', icon: FolderTree },
  { href: '/audit', label: 'Audit log', icon: ScrollText },
];

// Settings sits apart from the peers: at the foot of the desktop sidebar and
// as a gear in the phone top bar, so the bottom bar keeps its four tabs.
export const SETTINGS_ITEM: NavItem = { href: '/settings', label: 'Settings', icon: Settings };
