'use client';

import { useMemo } from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useReducedMotion } from '@/lib/hooks';
import { formatValue, type ChartSeries } from '../model';
import { AXIS_LINE, TICK, lineStyle } from './style';

export interface PlotLine extends ChartSeries {
  /** Index into the line styles, stable while the legend hides other lines. */
  style: number;
}

export interface LineSeriesChartProps {
  lines: readonly PlotLine[];
  decimals: number;
  unit: string;
  /** Where the value axis begins: 0 for shares and counts, the data's own floor for the rest. */
  fromZero?: boolean;
  /** The plot's accessible name; the table next to it carries the numbers. */
  label: string;
  /** X values printed as plain integers (years) unless a formatter is given. */
  xLabel?: (x: number) => string;
  /** Where the bottom axis puts its ticks, when whole years would not do. */
  xTicks?: readonly number[];
  /** Draws a dashed line at zero: the average an anomaly is measured from (the unit line names it). */
  zeroLine?: boolean;
}

interface Row {
  x: number;
  [line: string]: number;
}

interface TipEntry {
  dataKey: string;
  value: number;
}

/** Recharts hands tooltip entries back untyped: keep only the ones that are a line and a number. */
function isTipEntry(entry: unknown): entry is TipEntry {
  return (
    typeof entry === 'object' &&
    entry !== null &&
    'dataKey' in entry &&
    typeof entry.dataKey === 'string' &&
    'value' in entry &&
    typeof entry.value === 'number'
  );
}

/** The plot's paper tooltip: the x value, then each line's number with its own dash. */
function Tip({
  active,
  payload,
  label,
  decimals,
  unit,
  xLabel,
  lines,
}: {
  active: boolean;
  payload: readonly unknown[];
  label: string | number | undefined;
  decimals: number;
  unit: string;
  xLabel: (x: number) => string;
  lines: readonly PlotLine[];
}) {
  if (!active || payload.length === 0) return null;
  return (
    <div className="rounded-paper border-2 border-ink bg-paper px-2.5 py-1.5 font-mono text-data text-ink shadow-2">
      <p className="type-slug text-ink-3">{xLabel(Number(label))}</p>
      <ul className="mt-1 grid gap-0.5">
        {payload.map((entry) => {
          if (!isTipEntry(entry)) return null;
          const line = lines.find((candidate) => candidate.id === entry.dataKey);
          if (!line) return null;
          const style = lineStyle(line.style);
          return (
            <li key={line.id} className="flex items-center gap-2">
              <svg width="18" height="6" aria-hidden="true">
                <line
                  x1="0"
                  x2="18"
                  y1="3"
                  y2="3"
                  stroke={style.stroke}
                  strokeWidth="2"
                  strokeDasharray={style.dash || undefined}
                />
              </svg>
              {lines.length > 1 ? <span className="text-ink-2">{line.label}</span> : null}
              <span className="ml-auto font-semibold">
                {formatValue(entry.value, decimals)}
                <span className="ml-1 font-normal text-ink-3">{unit.split(' ')[0]}</span>
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/**
 * Lines on one value axis, in the bible's chart style: ink axes left and bottom only, hairline
 * horizontal grid, a 2 px line per series with its own dash, a yellow end marker with a direct
 * label. This module is the Recharts chunk: nothing else on the page imports the library.
 */
export function LineSeriesChart({
  lines,
  decimals,
  unit,
  fromZero = false,
  label,
  xLabel = (x) => String(x),
  xTicks,
  zeroLine = false,
}: LineSeriesChartProps) {
  const reduced = useReducedMotion();
  const rows = useMemo(() => {
    const byX = new Map<number, Row>();
    for (const line of lines) {
      for (const point of line.points) {
        const row = byX.get(point.x) ?? { x: point.x };
        row[line.id] = point.y;
        byX.set(point.x, row);
      }
    }
    return [...byX.values()].sort((a, b) => a.x - b.x);
  }, [lines]);

  const direct = lines.length <= 4;
  // Room on the right for the longest figure printed beside an end marker.
  const endRoom = direct
    ? 18 +
      7 *
        Math.max(
          0,
          ...lines.map((line) => formatValue(line.points.at(-1)?.y ?? 0, decimals).length),
        )
    : 14;
  return (
    <div role="img" aria-label={label} className="h-full w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={rows} margin={{ top: 14, right: endRoom, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--color-line)" strokeWidth={1} />
          <XAxis
            dataKey="x"
            type="number"
            domain={['dataMin', 'dataMax']}
            tickFormatter={(value: number) => xLabel(value)}
            tick={TICK}
            tickLine={false}
            axisLine={AXIS_LINE}
            ticks={xTicks ? [...xTicks] : undefined}
            minTickGap={24}
            tickMargin={6}
          />
          <YAxis
            width={44}
            domain={fromZero ? [0, 'auto'] : ['auto', 'auto']}
            tickFormatter={(value: number) => formatValue(value, Math.min(decimals, 1))}
            tick={TICK}
            tickLine={false}
            axisLine={AXIS_LINE}
            tickCount={5}
          />
          <Tooltip
            cursor={{ stroke: 'var(--color-ink)', strokeWidth: 1.5, strokeDasharray: '3 3' }}
            content={({ active, payload, label: at }) => (
              <Tip
                active={active}
                payload={payload}
                label={at}
                decimals={decimals}
                unit={unit}
                xLabel={xLabel}
                lines={lines}
              />
            )}
          />
          {zeroLine ? (
            <ReferenceLine
              y={0}
              stroke="var(--color-ink-3)"
              strokeWidth={1.5}
              strokeDasharray="4 3"
            />
          ) : null}
          {lines.map((line) => {
            const style = lineStyle(line.style);
            return (
              <Line
                key={line.id}
                dataKey={line.id}
                type="monotone"
                stroke={style.stroke}
                strokeWidth={2}
                strokeDasharray={style.dash || undefined}
                dot={false}
                activeDot={{
                  r: 4,
                  stroke: 'var(--color-ink)',
                  strokeWidth: 2,
                  fill: 'var(--color-yellow)',
                }}
                connectNulls
                isAnimationActive={!reduced}
                animationDuration={360}
              />
            );
          })}
          {lines.map((line) => {
            const end = line.points.at(-1);
            if (!end) return null;
            return (
              <ReferenceDot
                key={line.id}
                x={end.x}
                y={end.y}
                r={5}
                fill="var(--color-yellow)"
                stroke="var(--color-ink)"
                strokeWidth={2}
                ifOverflow="visible"
                label={
                  direct
                    ? {
                        value: formatValue(end.y, decimals),
                        position: 'right',
                        offset: 8,
                        ...TICK,
                        fill: 'var(--color-ink)',
                        fontWeight: 600,
                      }
                    : undefined
                }
              />
            );
          })}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
