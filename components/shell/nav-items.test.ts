import { describe, expect, it } from 'vitest';
import { isActive, mobileSections, navGroups } from './nav-items';

const shape = (groups: ReturnType<typeof navGroups>) =>
  groups.map((g) => ({ label: g.label ?? null, items: g.items.map((i) => i.href) }));

describe('navGroups', () => {
  it('groups the dashboard: Overview, Library, People, System', () => {
    expect(shape(navGroups({ kinds: ['audio'], role: 'owner' }))).toEqual([
      { label: null, items: ['/'] },
      { label: 'Library', items: ['/audio'] },
      { label: 'People', items: ['/users'] },
      { label: 'System', items: ['/system/providers', '/system/credits', '/system/audit'] },
    ]);
  });

  it('lists every kind the server has, in its order, and only those with pages', () => {
    const library = navGroups({ kinds: ['audio', 'template', 'font'], role: 'owner' })[1];
    expect(library.items.map((i) => i.label)).toEqual(['Audio', 'Fonts']);
  });

  it('shows non-owners only the parts of System they can use', () => {
    const system = navGroups({ kinds: ['audio'], role: 'admin' })[3];
    expect(system.items.map((i) => i.label)).toEqual(['Audit log']);
  });

  it('names the System items for what they are', () => {
    const system = navGroups({ kinds: ['audio'], role: 'owner' })[3];
    expect(system.items.map((i) => i.label)).toEqual(['AI providers', 'Credits', 'Audit log']);
  });
});

describe('isActive', () => {
  it('matches a section and everything under it', () => {
    expect(isActive('/audio', '/audio')).toBe(true);
    expect(isActive('/audio', '/audio/categories')).toBe(true);
    expect(isActive('/audio', '/audio/a1')).toBe(true);
    expect(isActive('/audio', '/audiobooks')).toBe(false);
  });

  it('matches Overview only on the home page', () => {
    expect(isActive('/', '/')).toBe(true);
    expect(isActive('/', '/audio')).toBe(false);
  });
});

describe('mobileSections', () => {
  it('keeps four sections on the phone bar, System opening where the role can work', () => {
    expect(mobileSections('owner').map((s) => [s.label, s.href])).toEqual([
      ['Overview', '/'],
      ['Library', '/audio'],
      ['Users', '/users'],
      ['System', '/system/providers'],
    ]);
    expect(mobileSections('viewer').find((s) => s.label === 'System')!.href).toBe('/system/audit');
  });

  it('marks Library active on any kind, and System on any system page', () => {
    const [, library, , system] = mobileSections('owner');
    expect(library.match.some((p) => isActive(p, '/fonts/f1'))).toBe(true);
    expect(system.match.some((p) => isActive(p, '/system/credits'))).toBe(true);
  });
});
