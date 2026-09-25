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
import type { AuditFilters } from './audit-filters-types';

/**
 * Unlike assets' status/kind, the server has no enum for actor/action/entity
 * type (admin-audit.controller.ts just passes each straight into a Prisma
 * `where` equality match) — so these are free-text inputs, not a Select or
 * segmented control. Each field is its own uncontrolled-by-URL input with
 * local draft state, committed onBlur/Enter, matching the "don't fight the
 * URL on every keystroke" lesson from assets' DebouncedSearchInput (a
 * lighter version suffices here since there's no debounce requirement in
 * the brief for this screen).
 */
function FilterField({
  id,
  label,
  value,
  onCommit,
}: {
  id: string;
  label: string;
  value: string;
  onCommit: (value: string) => void;
}) {
  const [draft, setDraft] = useState(value);

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-xs font-medium text-muted">
        {label}
      </label>
      <Input
        id={id}
        aria-label={label}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => onCommit(draft)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') onCommit(draft);
        }}
        className="md:w-48"
      />
    </div>
  );
}

function FilterFields({
  filters,
  onChange,
}: {
  filters: AuditFilters;
  onChange: (next: AuditFilters) => void;
}) {
  return (
    <div className="flex flex-col gap-3 md:flex-row md:items-end">
      <FilterField
        id="audit-filter-actor"
        label="Actor"
        value={filters.actorId ?? ''}
        onCommit={(actorId) => onChange({ ...filters, actorId: actorId || undefined })}
      />
      <FilterField
        id="audit-filter-action"
        label="Action"
        value={filters.action ?? ''}
        onCommit={(action) => onChange({ ...filters, action: action || undefined })}
      />
      <FilterField
        id="audit-filter-entity-type"
        label="Entity type"
        value={filters.entityType ?? ''}
        onCommit={(entityType) => onChange({ ...filters, entityType: entityType || undefined })}
      />
    </div>
  );
}

/**
 * Inline toolbar at md+ (spec §7); below md, a "Filters" button opens a
 * bottom sheet (shadcn Sheet side="bottom") — same split as assets'
 * AssetFiltersBar. `pathname` is accepted for parity with that component's
 * signature even though this bar doesn't need it directly (no debounced
 * search input here to build a replaceState URL for).
 */
export function AuditFiltersBar({
  filters,
  onChange,
}: {
  filters: AuditFilters;
  onChange: (next: AuditFilters) => void;
  pathname: string;
}) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const activeCount = [filters.actorId, filters.action, filters.entityType].filter(Boolean).length;

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
