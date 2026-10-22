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
   * Top-level category slugs the app looks for. A category tree with none of
   * them shows nothing in the app, so the Categories tab says which to create.
   */
  appRoots: { slug: string; name: string }[];
  /** What the app does with those categories, said under the empty Categories tab. */
  categoriesHint: string;
  /** Pages of the section beyond its list and Categories, as tabs between the two. */
  extraTabs: { label: string; href: string }[];
}

const SECTIONS: Record<string, LibrarySection> = {
  audio: {
    kind: 'audio',
    label: 'Audio',
    href: '/audio',
    icon: Music,
    noun: { one: 'sound', many: 'sounds' },
    appRoots: [
      { slug: 'sound-effects', name: 'Sound effects' },
      { slug: 'music', name: 'Music' },
    ],
    categoriesHint: 'The app shows its sub-categories as the pills to browse by.',
    extraTabs: [],
  },
  font: {
    kind: 'font',
    label: 'Fonts',
    href: '/fonts',
    icon: Type,
    noun: { one: 'font', many: 'fonts' },
    appRoots: [{ slug: 'trending', name: 'Trending' }],
    categoriesHint: 'The app lists the fonts filed under it, in the order you set on the Trending order tab.',
    extraTabs: [{ label: 'Trending order', href: '/fonts/order' }],
  },
};

export function librarySection(kind: string): LibrarySection | undefined {
  return SECTIONS[kind];
}

/** The page of one asset, under its kind's section. */
export function assetHref(kind: string, id: string): string {
  return `${(SECTIONS[kind] ?? SECTIONS.audio).href}/${encodeURIComponent(id)}`;
}
