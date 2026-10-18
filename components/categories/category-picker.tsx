'use client';

import { useQuery } from '@tanstack/react-query';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { fetchTree } from '@/lib/api/categories';
import { flattenWithDepth } from '@/lib/categories/tree-helpers';

/** Radix Select forbids an empty value, so "no category" needs a sentinel. */
const NONE = '__none__';

/**
 * Picks one category of a kind from the real tree, indented by depth. Hidden
 * categories can still be chosen (a sound can be filed before its pill shows).
 */
export function CategoryPicker({
  kind,
  value,
  onChange,
  label = 'Category',
  noneLabel = 'No category',
  className,
}: {
  kind: string;
  value: string | null;
  onChange: (categoryId: string | null) => void;
  label?: string;
  noneLabel?: string;
  className?: string;
}) {
  const query = useQuery({ queryKey: ['categories', kind], queryFn: () => fetchTree(kind) });
  const options = flattenWithDepth(query.data ?? []);

  return (
    <Select
      value={value ?? NONE}
      onValueChange={(v) => onChange(v === NONE ? null : v)}
      disabled={query.isLoading}
    >
      <SelectTrigger aria-label={label} className={className}>
        <SelectValue placeholder={noneLabel} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NONE}>{noneLabel}</SelectItem>
        {options.map((c) => (
          <SelectItem key={c.id} value={c.id}>
            <span style={{ paddingLeft: c.depth * 12 }}>
              {c.name}
              {c.isActive ? '' : ' (hidden)'}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
