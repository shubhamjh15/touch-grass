'use client';

import { useCallback, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { Approx, Co2e } from '@/ui';
import { cn } from '@/lib/cn';
import { COPY } from '../copy';
import {
  heatDay,
  heatGrid,
  heatLabel,
  heatTableRows,
  heatWord,
  type HeatCell,
  type HeatKind,
  type TableData,
} from '../model';
import { formatCo2Estimate, formatNumber } from '@/lib/format';
import type { DayImpact } from '@/game';
import { ChartCard } from './ChartCard';

const CELL = 14;
/** A young album has few columns, so its squares grow to fill the card, up to this size. */
const CELL_MAX = 30;
/** The weekday labels and their gap, which the squares share the width with. */
const LABEL_COLUMN = 34;
const GAP = 3;
const DAY_LABELS = ['Mon', '', 'Wed', '', 'Fri', '', ''] as const;

/**
 * Each mark has its own shape as well as its own colour: a full ring is solid green, a ring is
 * pale with a dot, rain is blue with rows, rest is hatched, and no ring is a dashed outline.
 */
const KIND_CLASS: Record<HeatKind, string> = {
  full: 'border-ink bg-green',
  ring: "border-ink bg-green-tint after:absolute after:inset-0 after:m-auto after:size-1 after:rounded-full after:bg-ink after:content-['']",
  rain: 'border-ink bg-blue-tint bg-[repeating-linear-gradient(0deg,var(--color-blue-deep)_0_1px,transparent_1px_4px)]',
  rest: 'hatch border-ink-3 bg-white',
  none: 'border-dashed border-ink-4 bg-transparent',
};

const LEGEND_ORDER: readonly HeatKind[] = ['full', 'ring', 'rain', 'rest', 'none'];

/** One mark, drawn the same way in the grid, the legend and a week's strip. */
export function HeatSwatch({ kind, size = CELL }: { kind: HeatKind; size?: number }) {
  return (
    <span
      aria-hidden="true"
      className={cn('relative block shrink-0 rounded-[3px] border-[1.5px]', KIND_CLASS[kind])}
      style={{ width: size, height: size }}
    />
  );
}

function heatTable(cells: readonly HeatCell[]): TableData {
  const rows = heatTableRows(cells);
  return {
    columns: ['Day', 'Mark', 'Logs', 'kg avoided (est.)'],
    rows: rows.map((cell) => [
      heatDay(cell.day),
      heatWord(cell.kind),
      formatNumber(cell.logs),
      cell.kg > 0 ? formatCo2Estimate(cell.kg) : '—',
    ]),
  };
}

/**
 * The activity heatmap: one square a day since planting, a week per column, like stickers
 * filling an album page. Pointer, tap and arrow keys read a day; the table view lists the days
 * that had anything in them. The scroller starts at today, the newest column.
 */
export function Heatmap({ heatmap }: { heatmap: readonly DayImpact[] }) {
  const grid = useMemo(() => heatGrid(heatmap), [heatmap]);
  const table = useMemo(() => heatTable(grid.cells), [grid.cells]);
  const [selected, setSelected] = useState<number | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const byKeyboard = useRef(false);
  const [room, setRoom] = useState(0);

  // Few weeks: let the squares grow into the card. Many weeks: the 14 px grid scrolls sideways.
  useLayoutEffect(() => {
    const node = scroller.current;
    if (!node) return undefined;
    const measure = () => setRoom(node.clientWidth);
    measure();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  const cell =
    grid.columns > 0 && room > 0
      ? Math.min(CELL_MAX, Math.max(CELL, Math.floor((room - LABEL_COLUMN) / grid.columns) - GAP))
      : CELL;

  useLayoutEffect(() => {
    const node = scroller.current;
    if (node) node.scrollLeft = node.scrollWidth;
  }, [grid.columns, cell]);

  useLayoutEffect(() => {
    if (selected === null || !byKeyboard.current) return;
    byKeyboard.current = false;
    scroller.current
      ?.querySelector(`[data-index="${selected}"]`)
      ?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [selected]);

  const last = grid.cells.length - 1;
  const pick = useCallback((target: EventTarget | null) => {
    if (!(target instanceof Element)) return;
    const index = Number(target.closest('[data-index]')?.getAttribute('data-index'));
    if (Number.isInteger(index)) setSelected(index);
  }, []);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const step: Partial<Record<string, number>> = {
      ArrowUp: -1,
      ArrowDown: 1,
      ArrowLeft: -7,
      ArrowRight: 7,
    };
    const at = selected ?? last;
    let next: number | null = null;
    if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = last;
    else if (event.key in step) next = at + (step[event.key] ?? 0);
    if (next === null) return;
    event.preventDefault();
    byKeyboard.current = true;
    setSelected(Math.min(last, Math.max(0, next)));
  };

  const current = selected === null ? null : (grid.cells[selected] ?? null);
  const detail = current ? (
    <>
      {heatLabel({ ...current, kg: 0 })}
      {current.kg > 0 ? (
        <>
          , <Approx weight="mono" spoken={false} />
          {formatCo2Estimate(current.kg)} <Co2e />
        </>
      ) : null}
    </>
  ) : (
    COPY.heat.hint
  );

  const plot = (
    <div className="grid h-full content-start gap-3">
      <div ref={scroller} className="-mx-1 overflow-x-auto px-1 pt-1 pb-2">
        <div
          role="group"
          tabIndex={0}
          aria-label={COPY.heat.areaLabel}
          onKeyDown={onKeyDown}
          onClick={(event) => pick(event.target)}
          onPointerOver={(event) => {
            if (event.pointerType === 'mouse') pick(event.target);
          }}
          onFocus={() => setSelected((value) => value ?? last)}
          className="grid w-max gap-x-1.5 rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ink"
          style={{ gridTemplateColumns: `auto ${grid.columns * (cell + GAP)}px` }}
        >
          <span aria-hidden="true" />
          <div className="relative h-4" aria-hidden="true">
            {grid.months.map((month) => (
              <span
                key={`${month.column}-${month.label}`}
                className="absolute top-0 type-tick text-ink-3"
                style={{ left: month.column * (cell + GAP) }}
              >
                {month.label}
              </span>
            ))}
          </div>
          <div
            aria-hidden="true"
            className="grid type-tick text-ink-3"
            style={{ gridTemplateRows: `repeat(7, ${cell}px)`, rowGap: GAP }}
          >
            {DAY_LABELS.map((label, index) => (
              <span key={`${label}-${index}`} style={{ lineHeight: `${cell}px` }}>
                {label}
              </span>
            ))}
          </div>
          <div
            className="grid grid-flow-col"
            style={{
              gridTemplateRows: `repeat(7, ${cell}px)`,
              gridAutoColumns: cell,
              gap: GAP,
            }}
          >
            {grid.slots.map((slot, index) =>
              slot ? (
                <span
                  key={slot.day}
                  data-index={slot.index}
                  data-kind={slot.kind}
                  className={cn(
                    'relative block rounded-[3px] border-[1.5px]',
                    KIND_CLASS[slot.kind],
                    slot.index === selected && 'outline-2 outline-offset-2 outline-ink',
                  )}
                />
              ) : (
                <span key={`pad-${index}`} aria-hidden="true" />
              ),
            )}
          </div>
        </div>
      </div>
      <p
        aria-live="polite"
        className="min-h-5 font-mono text-data text-ink-2"
        data-testid="heat-detail"
      >
        {detail}
      </p>
    </div>
  );

  return (
    <ChartCard
      fig="FIG. 03"
      title={COPY.heat.title}
      unit={COPY.heat.unit}
      lazyPlot={false}
      plotClassName="h-auto"
      plot={plot}
      table={table}
      tableCaption="Days with a ring, a log or a rest, newest first"
      caption={COPY.heat.caption}
      legend={
        <ul aria-label="Legend" className="flex flex-wrap gap-x-4 gap-y-2">
          {LEGEND_ORDER.map((kind) => (
            <li key={kind} className="flex items-center gap-1.5 text-caption text-ink-2">
              <HeatSwatch kind={kind} />
              {COPY.heat.legend[kind]}
            </li>
          ))}
        </ul>
      }
    />
  );
}
