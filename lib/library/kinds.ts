import { Music, Type, type LucideIcon } from 'lucide-react';

/**
 * The Library: one section per kind of content the dashboard has pages for.
 * A kind the server lists but that has no entry here (no pages yet) is left
 * out of the navigation rather than linking to nothing.
 */
export interface LibrarySection {
  kind: string;
  label: string;
  href: string;
  icon: LucideIcon;
  noun: { one: string; many: string };
  /**
   * The section's categories, or null for a kind without them (fonts: the app
   * lists every published font in one order). `appRoots` are the top-level
   * category slugs the app looks for: a tree with none of them shows nothing
   * in the app, so the Categories tab says which to create, and `hint` says
   * what the app does with them.
   */
  categories: { appRoots: { slug: string; name: string }[]; hint: string } | null;
  /** Pages of the section beyond its list (and Categories), as tabs after the list. */
  extraTabs: { label: string; href: string }[];
}

const SECTIONS: Record<string, LibrarySection> = {
  audio: {
    kind: 'audio',
    label: 'Audio',
    href: '/audio',
    icon: Music,
    noun: { one: 'sound', many: 'sounds' },
    categories: {
      appRoots: [
        { slug: 'sound-effects', name: 'Sound effects' },
        { slug: 'music', name: 'Music' },
      ],
      hint: 'The app shows its sub-categories as the pills to browse by.',
    },
    extraTabs: [],
  },
  font: {
    kind: 'font',
    label: 'Fonts',
    href: '/fonts',
    icon: Type,
    noun: { one: 'font', many: 'fonts' },
    categories: null,
    extraTabs: [{ label: 'Order', href: '/fonts/order' }],
  },
};

export function librarySection(kind: string): LibrarySection | undefined {
  return SECTIONS[kind];
}

/** Whether assets of this kind are filed in categories. A kind with no section is assumed to be. */
export function usesCategories(kind: string): boolean {
  return SECTIONS[kind]?.categories !== null;
}

/** The page of one asset, under its kind's section. */
export function assetHref(kind: string, id: string): string {
  return `${(SECTIONS[kind] ?? SECTIONS.audio).href}/${encodeURIComponent(id)}`;
}
