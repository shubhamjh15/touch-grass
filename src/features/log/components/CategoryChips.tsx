'use client';

import { CATEGORY_IDS, type CategoryId } from '@/data/catalogue';
import { CATEGORY, Chip } from '@/ui';
import { COPY } from '../copy';

export interface CategoryChipsProps {
  /** The kind being shown, or `null` for every kind. */
  value: CategoryId | null;
  onChange: (value: CategoryId | null) => void;
}

/**
 * The seven kinds in one scrolling row. Each chip is a toggle: press one to see only that
 * kind, press it again to see everything.
 */
export function CategoryChips({ value, onChange }: CategoryChipsProps) {
  return (
    <div role="group" aria-label={COPY.chips.label} className="scroll-row gap-2">
      {CATEGORY_IDS.map((id) => (
        <Chip
          key={id}
          selected={value === id}
          onSelectedChange={(selected) => onChange(selected ? id : null)}
          className="h-10 px-4 text-body-sm"
        >
          {CATEGORY[id].label}
        </Chip>
      ))}
    </div>
  );
}
