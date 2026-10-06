'use client';

import { Check } from 'lucide-react';
import { useId } from 'react';
import { cn } from '@/lib/cn';
import { SPECIES, WorldStage, type Species, type WorldSnapshot } from '@/world';
import { COPY, SPECIES_COPY } from '../copy';

/** How grown the preview trees are: far enough along for each silhouette to read at a glance. */
export const PREVIEW_GROWTH = 0.9;

const PREVIEW: Readonly<Record<Species, Partial<WorldSnapshot>>> = {
  oak: { species: 'oak', growth: PREVIEW_GROWTH, vitality: 1, ageDays: 0, props: [] },
  cherry: { species: 'cherry', growth: PREVIEW_GROWTH, vitality: 1, ageDays: 0, props: [] },
  pine: { species: 'pine', growth: PREVIEW_GROWTH, vitality: 1, ageDays: 0, props: [] },
};

export interface SpeciesPickerProps {
  value: Species;
  onChange: (species: Species) => void;
  className?: string;
}

/**
 * Three large cards, each showing the tree it stands for. Real radio buttons underneath, so
 * the arrow keys move between them and a screen reader hears "Oak, 1 of 3". The chosen card
 * is tinted and takes a check: colour is never the only signal.
 */
export function SpeciesPicker({ value, onChange, className }: SpeciesPickerProps) {
  const name = useId();
  return (
    <fieldset className={cn('min-w-0', className)}>
      <legend className="sr-only">{COPY.tree.species}</legend>
      <div className="grid grid-cols-3 gap-2.5 sm:gap-4">
        {SPECIES.map((species) => {
          const copy = SPECIES_COPY[species];
          const checked = species === value;
          return (
            <label
              key={species}
              className={cn(
                'relative flex min-w-0 hard cursor-pointer flex-col items-center rounded-lg border-2 border-ink px-1.5 pt-2 pb-3 text-center text-ink focus-within-ring lift-2 sm:px-3 sm:pb-4',
                checked ? 'bg-yellow-tint' : 'bg-card',
              )}
            >
              <input
                type="radio"
                name={name}
                value={species}
                checked={checked}
                onChange={() => onChange(species)}
                className="sr-only"
              />
              {/* The picture repeats the label, so assistive technology hears the name once. */}
              <span aria-hidden="true" className="block aspect-square w-full">
                <WorldStage
                  mode="companion"
                  interactive={false}
                  preview={PREVIEW[species]}
                  className="size-full"
                />
              </span>
              <span className="mt-1 flex items-center justify-center gap-1.5 text-body font-bold">
                {/* Beside the name, never on the tree. */}
                {checked ? (
                  <Check
                    size={18}
                    strokeWidth={3}
                    aria-hidden="true"
                    className="shrink-0 animate-pop"
                  />
                ) : null}
                {copy.name}
              </span>
              <span className="mt-0.5 hidden text-body-sm text-ink-3 sm:block">{copy.line}</span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
