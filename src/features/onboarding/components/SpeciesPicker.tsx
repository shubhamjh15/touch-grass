'use client';

import { Check } from 'lucide-react';
import { useId } from 'react';
import { cn } from '@/lib/cn';
import { SPECIES, type Species } from '@/world';
import { SPECIES_COPY } from '../copy';

const INK = 'var(--color-ink)';
const LINE = {
  stroke: INK,
  strokeWidth: 2.5,
  strokeLinejoin: 'round' as const,
  strokeLinecap: 'round' as const,
};

/**
 * The three silhouettes, drawn like the grove: flat fills, one ink line. The outline alone
 * tells them apart (round crown, wide cloud, stacked tiers); colour only helps.
 */
function SpeciesArt({ species }: { species: Species }) {
  return (
    <svg
      viewBox="0 0 64 64"
      width="64"
      height="64"
      aria-hidden="true"
      focusable="false"
      className="block h-14 w-14 overflow-visible sm:h-16 sm:w-16"
    >
      <ellipse cx="32" cy="58" rx="19" ry="3.5" fill="var(--color-green)" {...LINE} />
      {species === 'oak' ? (
        <>
          <path d="M28.5 57l1.5-21h4l1.500 21z" fill="var(--color-bark)" {...LINE} />
          <path
            d="M32 5c7 0 12 4 13 9.500 6 1.500 9.500 6 9.500 11.500 0 7-6 12-13.500 12H23c-7.500 0-13.500-5-13.500-12 0-5.500 3.500-10 9.500-11.500C20 9 25 5 32 5z"
            fill="var(--color-green)"
            {...LINE}
          />
          <path d="M22 22c2.500-3.500 6-5 10-5" fill="none" {...LINE} stroke="var(--color-white)" />
        </>
      ) : null}
      {species === 'cherry' ? (
        <>
          <path
            d="M29 57c1-7 .5-13-2-19l4-1.500 2 5 3.500-6 3.500 2c-3.500 6-5 12-4.500 19.500z"
            fill="var(--color-bark)"
            {...LINE}
          />
          <path
            d="M15 37.500c-6.500-.5-10.500-5-10.500-10.500 0-5 3.500-9 8.500-10 1.500-6 7-10 13.500-10 3.500 0 6.500 1 9 3 2-1.200 4.200-1.800 6.500-1.800 6.500 0 12 4.800 12.500 11 3.500 1.800 5.500 5.300 5.500 9 0 5.500-4.500 9.800-10.500 9.800z"
            fill="var(--color-pink)"
            {...LINE}
          />
          <circle cx="20" cy="24" r="2.200" fill="var(--color-white)" />
          <circle cx="36" cy="17" r="2.200" fill="var(--color-white)" />
          <circle cx="47" cy="28" r="2.200" fill="var(--color-white)" />
          <circle cx="29" cy="30" r="1.600" fill="var(--color-white)" />
        </>
      ) : null}
      {species === 'pine' ? (
        <>
          <path d="M29 57l.5-9h5l.5 9z" fill="var(--color-bark)" {...LINE} />
          <path d="M32 26l17 22H15z" fill="var(--color-moss)" {...LINE} />
          <path d="M32 14l14 20H18z" fill="var(--color-moss)" {...LINE} />
          <path d="M32 3l10.500 17h-21z" fill="var(--color-moss)" {...LINE} />
        </>
      ) : null}
    </svg>
  );
}

export interface SpeciesPickerProps {
  value: Species;
  onChange: (species: Species) => void;
  className?: string;
}

/**
 * Three species cards. Real radio buttons underneath, so the arrow keys move between them
 * and a screen reader hears "Oak, steady and broad, 1 of 3". The chosen card turns yellow
 * and takes a check: colour is never the only signal.
 */
export function SpeciesPicker({ value, onChange, className }: SpeciesPickerProps) {
  const name = useId();
  return (
    <fieldset className={cn('min-w-0', className)}>
      <legend className="sr-only">Species</legend>
      <div className="grid grid-cols-3 gap-2.5 sm:gap-3">
        {SPECIES.map((species) => {
          const copy = SPECIES_COPY[species];
          const checked = species === value;
          return (
            <label
              key={species}
              className={cn(
                'relative flex min-h-11 hard cursor-pointer flex-col items-center gap-2 rounded-md border-3 border-ink px-1.5 pt-3 pb-3 text-center text-ink focus-within-ring lift-3 sm:px-3',
                checked ? 'bg-yellow' : 'bg-card',
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
              <SpeciesArt species={species} />
              <span className="block text-label leading-tight">{copy.name}</span>
              <span className={cn('block text-caption', checked ? 'text-ink' : 'text-ink-3')}>
                {copy.line}
              </span>
              {checked ? (
                <span
                  aria-hidden="true"
                  className="absolute -top-2.5 -right-2.5 grid size-6 animate-pop place-items-center rounded-full border-2 border-ink bg-white"
                >
                  <Check size={14} strokeWidth={3.25} />
                </span>
              ) : null}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
