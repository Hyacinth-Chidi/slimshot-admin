import { describe, expect, it } from 'vitest';
import { flattenTree, type Category } from './categories';

function cat(overrides: Partial<Category> & { id: string; name: string }): Category {
  return {
    kind: 'audio',
    parentId: null,
    slug: overrides.id,
    description: null,
    sortOrder: 0,
    isActive: true,
    ...overrides,
  };
}

describe('flattenTree', () => {
  it('returns an empty list for an empty tree', () => {
    expect(flattenTree([])).toEqual([]);
  });

  it('flattens root categories at depth 0', () => {
    const tree = [cat({ id: 'a', name: 'A' }), cat({ id: 'b', name: 'B' })];
    const flat = flattenTree(tree);
    expect(flat).toEqual([
      { category: tree[0], depth: 0 },
      { category: tree[1], depth: 0 },
    ]);
  });

  it('flattens depth-first, placing children immediately after their parent', () => {
    const child = cat({ id: 'a1', name: 'A1', parentId: 'a' });
    const parent = { ...cat({ id: 'a', name: 'A' }), children: [child] };
    const sibling = cat({ id: 'b', name: 'B' });

    const flat = flattenTree([parent, sibling]);

    expect(flat.map((f) => f.category.id)).toEqual(['a', 'a1', 'b']);
    expect(flat.map((f) => f.depth)).toEqual([0, 1, 0]);
  });

  it('handles multiple levels of nesting', () => {
    const grandchild = cat({ id: 'a1a', name: 'A1a', parentId: 'a1' });
    const child = { ...cat({ id: 'a1', name: 'A1', parentId: 'a' }), children: [grandchild] };
    const parent = { ...cat({ id: 'a', name: 'A' }), children: [child] };

    const flat = flattenTree([parent]);

    expect(flat.map((f) => f.category.id)).toEqual(['a', 'a1', 'a1a']);
    expect(flat.map((f) => f.depth)).toEqual([0, 1, 2]);
  });
});
