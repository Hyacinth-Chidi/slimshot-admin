'use client';

import { useState } from 'react';
import { SlidersHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { CategoryPicker } from '@/components/categories/category-picker';
import { usesCategories } from '@/lib/library/kinds';
import { cn } from '@/lib/cn';
import type { AssetStatus } from '@/components/ui/status-pill';
import type { AssetFilters } from '@/lib/api/assets';
import { DebouncedSearchInput } from './debounced-search-input';
import { searchParamsFromFilters } from './filters-url';

/** The server's AssetStatus enum (../slimshot_server/src/generated/prisma/enums.ts:21-28). */
const STATUS_OPTIONS: readonly { value: AssetStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'draft', label: 'Draft' },
  { value: 'processing', label: 'Processing' },
  { value: 'ready', label: 'Ready' },
  { value: 'published', label: 'Published' },
  { value: 'archived', label: 'Archived' },
  { value: 'failed', label: 'Failed' },
];

/** The server's AssetKind enum (../slimshot_server/src/generated/prisma/enums.ts:12-16). */
const KIND_OPTIONS: readonly { value: string; label: string }[] = [
  { value: 'audio', label: 'Audio' },
  { value: 'font', label: 'Font' },
  { value: 'template', label: 'Template' },
];

/**
 * R8h: a segmented control, not a select — first in the filter row, 44px
 * targets below md. It's allowed to scroll horizontally within itself on a
 * phone (a row of 7 pills doesn't fit 375px), but that scroll must stay
 * contained — the page itself never gains horizontal scroll from it.
 */
function StatusSegmentedControl({
  value,
  onChange,
}: {
  value: AssetStatus | undefined;
  onChange: (status: AssetStatus | undefined) => void;
}) {
  return (
    <div
      role="radiogroup"
      aria-label="Status"
      className="flex gap-1 overflow-x-auto"
    >
      {STATUS_OPTIONS.map((opt) => {
        const active = opt.value === 'all' ? value === undefined : value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(opt.value === 'all' ? undefined : opt.value)}
            className={cn(
              'h-11 shrink-0 rounded-lg border px-3 text-sm font-medium transition-colors duration-150 ease-out md:h-8',
              active
                ? 'border-transparent bg-elevated text-text'
                : 'border-border bg-transparent text-muted hover:bg-elevated',
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

function KindSelect({
  value,
  onChange,
}: {
  value: string | undefined;
  onChange: (kind: string | undefined) => void;
}) {
  return (
    <Select value={value ?? 'all'} onValueChange={(v) => onChange(v === 'all' ? undefined : v)}>
      <SelectTrigger className="md:w-40" aria-label="Kind">
        <SelectValue placeholder="All kinds" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">All kinds</SelectItem>
        {KIND_OPTIONS.map((opt) => (
          <SelectItem key={opt.value} value={opt.value}>
            {opt.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function FilterFields({
  filters,
  onChange,
  pathname,
  kind,
}: {
  filters: AssetFilters;
  onChange: (next: AssetFilters) => void;
  pathname: string;
  kind?: string;
}) {
  return (
    <div className="flex flex-col gap-3">
      <StatusSegmentedControl
        value={filters.status}
        onChange={(status) => onChange({ ...filters, status })}
      />
      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <DebouncedSearchInput
          value={filters.search ?? ''}
          buildUrl={(search) => {
            const params = searchParamsFromFilters({ ...filters, search: search || undefined });
            return `${pathname}${params.toString() ? `?${params}` : ''}`;
          }}
        />
        {!kind && <KindSelect value={filters.kind} onChange={(next) => onChange({ ...filters, kind: next })} />}
        {usesCategories(kind ?? filters.kind ?? 'audio') && (
          <CategoryPicker
            kind={kind ?? filters.kind ?? 'audio'}
            value={filters.categoryId ?? null}
            onChange={(categoryId) => onChange({ ...filters, categoryId: categoryId ?? undefined })}
            noneLabel="All categories"
            className="md:w-48"
          />
        )}
      </div>
    </div>
  );
}

/**
 * Inline toolbar at md+ (spec §7); below md, a "Filters" button opens a
 * bottom sheet (shadcn Sheet side="bottom" — no hand-rolled overlay).
 */
export function AssetFiltersBar({
  filters,
  onChange,
  pathname,
  kind,
}: {
  filters: AssetFilters;
  onChange: (next: AssetFilters) => void;
  /** Needed by the debounced search input to write history.replaceState URLs. */
  pathname: string;
  /** Set inside a Library section: the kind is fixed, so there is no kind picker. */
  kind?: string;
}) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const activeCount = [filters.status, filters.search, kind ? undefined : filters.kind, filters.categoryId].filter(
    Boolean,
  ).length;

  return (
    <>
      <div className="hidden md:block">
        <FilterFields filters={filters} onChange={onChange} pathname={pathname} kind={kind} />
      </div>

      <div className="md:hidden">
        <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
          <SheetTrigger asChild>
            <Button variant="secondary" size="md">
              <SlidersHorizontal className="size-4" />
              Filters
              {activeCount > 0 ? ` (${activeCount})` : ''}
            </Button>
          </SheetTrigger>
          <SheetContent side="bottom">
            <SheetHeader>
              <SheetTitle>Filters</SheetTitle>
            </SheetHeader>
            <div className="px-4 pb-4">
              <FilterFields filters={filters} onChange={onChange} pathname={pathname} kind={kind} />
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </>
  );
}
