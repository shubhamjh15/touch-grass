'use client';

import { Check, Globe2 } from 'lucide-react';
import { useId, useMemo, useState } from 'react';
import { DEFAULT_REGION, GRID, type RegionId } from '@/data/catalogue';
import { cn } from '@/lib/cn';
import { formatNumber } from '@/lib/format';
import { Button, Co2e, IconTile, Panel, SearchInput } from '@/ui';
import { regionName } from '../flow';

interface RegionRow {
  id: RegionId;
  name: string;
  /** Grams of CO2e per kWh of electricity: why the region matters, in one figure. */
  grams: number;
  kind: 'world' | 'country' | 'region';
}

const byName = (a: RegionRow, b: RegionRow) => a.name.localeCompare(b.name, 'en');

/** World average first, then countries, then continental regions, each alphabetical. */
const ROWS: readonly RegionRow[] = (() => {
  const rows = GRID.map((entry): RegionRow => ({
    id: entry.id,
    name: regionName(entry.id),
    grams: entry.kgCO2ePerKWh * 1000,
    kind: entry.type,
  }));
  return [
    ...rows.filter((row) => row.kind === 'world'),
    ...rows.filter((row) => row.kind === 'country').sort(byName),
    ...rows.filter((row) => row.kind === 'region').sort(byName),
  ];
})();

const KIND_LABEL: Record<RegionRow['kind'], string> = {
  world: 'Default',
  country: 'Countries',
  region: 'Wider regions',
};

function matches(row: RegionRow, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return row.name.toLowerCase().includes(needle) || row.id.toLowerCase() === needle;
}

export interface RegionListProps {
  value: RegionId;
  onChange: (region: RegionId) => void;
  /** Accessible name of the group of options. */
  label: string;
  className?: string;
}

/**
 * Every grid region as a searchable list of radio buttons. Each row prints the grid's
 * carbon intensity, so the question explains itself: the same kettle is not the same kettle
 * everywhere.
 */
export function RegionList({ value, onChange, label, className }: RegionListProps) {
  const name = useId();
  const [query, setQuery] = useState('');
  const shown = useMemo(() => ROWS.filter((row) => matches(row, query)), [query]);
  const kinds = (['world', 'country', 'region'] as const).filter((kind) =>
    shown.some((row) => row.kind === kind),
  );

  return (
    <div className={cn('flex min-w-0 flex-col gap-2.5', className)}>
      <SearchInput
        value={query}
        onValueChange={setQuery}
        label={`Search ${formatNumber(ROWS.length)} places`}
        resultCount={shown.length}
        autoComplete="off"
        enterKeyHint="search"
      />
      <Panel
        variant="well"
        className="max-h-64 overflow-y-auto overscroll-contain p-1.5 lg:max-h-72"
      >
        {shown.length === 0 ? (
          <p className="px-2.5 py-4 text-body-sm text-ink-2">
            Nothing by that name. The world average works for anywhere.
          </p>
        ) : (
          <div role="radiogroup" aria-label={label} className="flex flex-col gap-0.5">
            {kinds.map((kind) => (
              <div key={kind} role="presentation" className="flex flex-col gap-0.5">
                {kind !== 'world' ? (
                  <p aria-hidden="true" className="px-2.5 pt-2.5 pb-1 type-tick text-ink-3">
                    {KIND_LABEL[kind]}
                  </p>
                ) : null}
                {shown
                  .filter((row) => row.kind === kind)
                  .map((row) => {
                    const checked = row.id === value;
                    return (
                      <label
                        key={row.id}
                        className={cn(
                          'flex min-h-11 cursor-pointer items-center gap-2.5 rounded-sm border-2 px-2.5 py-1.5 text-ink has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-ink',
                          checked
                            ? 'border-ink bg-yellow'
                            : 'border-transparent fine:hover:border-ink fine:hover:bg-white',
                        )}
                      >
                        <input
                          type="radio"
                          name={name}
                          value={row.id}
                          checked={checked}
                          onChange={() => onChange(row.id)}
                          className="sr-only"
                        />
                        <span
                          aria-hidden="true"
                          className={cn(
                            'grid size-5 shrink-0 place-items-center rounded-full border-2 border-ink',
                            checked ? 'bg-white' : 'bg-card',
                          )}
                        >
                          {checked ? <Check size={12} strokeWidth={3.5} /> : null}
                        </span>
                        <span className="min-w-0 flex-1 text-label">{row.name}</span>
                        <span
                          className={cn(
                            'shrink-0 font-mono text-data-sm',
                            checked ? 'text-ink' : 'text-ink-3',
                          )}
                        >
                          {formatNumber(Math.round(row.grams))} g/kWh
                        </span>
                      </label>
                    );
                  })}
              </div>
            ))}
          </div>
        )}
      </Panel>
      <p className="text-caption text-ink-3">
        Grams of <Co2e /> for each kilowatt-hour of electricity on that grid.
      </p>
    </div>
  );
}

export interface RegionFieldProps {
  value: RegionId;
  onChange: (region: RegionId) => void;
  label: string;
  /** One line on why we ask. */
  reason: string;
  className?: string;
}

/**
 * The region as one quiet row that opens into the full list: the default (world average) is
 * a fine answer, so the list stays out of the way until someone wants it.
 */
export function RegionField({ value, onChange, label, reason, className }: RegionFieldProps) {
  const [open, setOpen] = useState(false);
  const listId = useId();
  const labelId = useId();
  const isDefault = value === DEFAULT_REGION;

  return (
    <div className={cn('min-w-0', className)}>
      <p id={labelId} className="mb-1.5 text-label text-ink">
        {label} <span className="font-medium text-ink-3">(optional)</span>
      </p>
      <div className="flex items-center gap-3 rounded-ctl border-3 border-ink bg-white py-1.5 pr-1.5 pl-2.5">
        <IconTile hue={isDefault ? 'blue' : 'green'} className="size-9">
          <Globe2 size={18} strokeWidth={2.25} />
        </IconTile>
        <p className="min-w-0 flex-1 truncate text-body font-semibold text-ink" aria-live="polite">
          {regionName(value)}
        </p>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          aria-expanded={open}
          aria-controls={listId}
          aria-describedby={labelId}
          onClick={() => setOpen((current) => !current)}
        >
          {open ? 'Done' : 'Change'}
        </Button>
      </div>
      <p className="mt-1.5 text-caption text-ink-3">{reason}</p>
      <div id={listId} hidden={!open} className="mt-3">
        {open ? <RegionList value={value} onChange={onChange} label={label} /> : null}
      </div>
    </div>
  );
}
