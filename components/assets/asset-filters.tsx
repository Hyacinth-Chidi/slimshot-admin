'use client';

import { useState } from 'react';
import { SlidersHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import type { AssetStatus } from '@/components/ui/status-pill';
import type { AssetFilters } from '@/lib/api/assets';

const STATUS_OPTIONS: readonly AssetStatus[] = [
  'draft',
  'processing',
  'ready',
  'published',
  'archived',
  'failed',
];

function FilterFields({
  filters,
  onChange,
}: {
  filters: AssetFilters;
  onChange: (next: AssetFilters) => void;
}) {
  return (
    <div className="flex flex-col gap-3 md:flex-row md:items-center">
      <Input
        placeholder="Search title…"
        value={filters.search ?? ''}
        onChange={(e) => onChange({ ...filters, search: e.target.value || undefined })}
        className="md:w-56"
      />
      <select
        aria-label="Status"
        value={filters.status ?? ''}
        onChange={(e) =>
          onChange({ ...filters, status: (e.target.value || undefined) as AssetStatus | undefined })
        }
        className="h-11 rounded-lg border border-border bg-elevated px-3 text-sm text-text md:h-10"
      >
        <option value="">All statuses</option>
        {STATUS_OPTIONS.map((status) => (
          <option key={status} value={status}>
            {status}
          </option>
        ))}
      </select>
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
}: {
  filters: AssetFilters;
  onChange: (next: AssetFilters) => void;
}) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const activeCount = [filters.status, filters.search].filter(Boolean).length;

  return (
    <>
      <div className="hidden md:block">
        <FilterFields filters={filters} onChange={onChange} />
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
              <FilterFields filters={filters} onChange={onChange} />
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </>
  );
}
