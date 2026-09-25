import { describe, expect, it } from 'vitest';
import type { Category } from '@/lib/api/categories';
import { buildTree, moveSibling } from './tree-helpers';

function cat(overrides: Partial<Category> & { id: string }): Category {
  return {
    kind: 'audio',
    parentId: null,
    slug: overrides.id,
    name: overrides.id,
    description: null,
    sortOrder: 0,
    isActive: true,
    ...overrides,
  };
}

describe('buildTree', () => {
  it('returns nested nodes as-is when the server already nests children', () => {
    const nested: Category[] = [cat({ id: 'a', children: [cat({ id: 'b', parentId: 'a' })] })];
    expect(buildTree(nested)).toEqual(nested);
  });

  it('assembles a flat list (parentId, no children) into a nested tree', () => {
    const flat: Category[] = [
      cat({ id: 'a', sortOrder: 0 }),
      cat({ id: 'b', parentId: 'a', sortOrder: 0 }),
      cat({ id: 'c', sortOrder: 1 }),
    ];
    const tree = buildTree(flat);
    expect(tree.map((n) => n.id)).toEqual(['a', 'c']);
    expect(tree[0].children?.map((n) => n.id)).toEqual(['b']);
  });

  it('sorts roots and children by sortOrder', () => {
    const flat: Category[] = [
      cat({ id: 'b', sortOrder: 1 }),
      cat({ id: 'a', sortOrder: 0 }),
    ];
    expect(buildTree(flat).map((n) => n.id)).toEqual(['a', 'b']);
  });

  it('treats a category whose parent is missing from the list as a root, rather than dropping it', () => {
    const flat: Category[] = [cat({ id: 'orphan', parentId: 'missing-parent' })];
    expect(buildTree(flat).map((n) => n.id)).toEqual(['orphan']);
  });
});

describe('moveSibling', () => {
  const siblings: Category[] = [
    cat({ id: 'a', sortOrder: 0 }),
    cat({ id: 'b', sortOrder: 1 }),
    cat({ id: 'c', sortOrder: 2 }),
  ];

  it('moving a middle item up swaps it with its predecessor', () => {
    const result = moveSibling(siblings, 'b', 'up');
    expect(result).toEqual([
      { id: 'b', sortOrder: 0 },
      { id: 'a', sortOrder: 1 },
      { id: 'c', sortOrder: 2 },
    ]);
  });

  it('moving a middle item down swaps it with its successor', () => {
    const result = moveSibling(siblings, 'b', 'down');
    expect(result).toEqual([
      { id: 'a', sortOrder: 0 },
      { id: 'c', sortOrder: 1 },
      { id: 'b', sortOrder: 2 },
    ]);
  });

  it('moving the first item up is a no-op (returns null)', () => {
    expect(moveSibling(siblings, 'a', 'up')).toBeNull();
  });

  it('moving the last item down is a no-op (returns null)', () => {
    expect(moveSibling(siblings, 'c', 'down')).toBeNull();
  });

  it('re-numbers sortOrder contiguously from 0 regardless of the input gaps', () => {
    const gappy: Category[] = [cat({ id: 'a', sortOrder: 5 }), cat({ id: 'b', sortOrder: 20 })];
    expect(moveSibling(gappy, 'b', 'up')).toEqual([
      { id: 'b', sortOrder: 0 },
      { id: 'a', sortOrder: 1 },
    ]);
  });
});
