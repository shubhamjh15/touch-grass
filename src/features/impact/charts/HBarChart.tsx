'use client';

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useReducedMotion } from '@/lib/hooks';
import { formatValue } from '../model';
import { AXIS_LINE, TICK } from './style';

export interface BarRow {
  id: string;
  label: string;
  value: number;
  /** A CSS colour: always a token such as `var(--color-cat-eat-mark)`. */
  fill: string;
  /** What prints at the end of the bar. */
  text: string;
  /** The line the tooltip adds under the name. */
  detail?: string;
}

export interface HBarChartProps {
  rows: readonly BarRow[];
  label: string;
  /** Width given to the names on the left. */
  nameWidth?: number;
  /** Thickness of a bar (at most 24). */
  barSize?: number;
  /** Room on the right for the figure printed at the end of the longest bar. */
  labelRoom?: number;
}

function isBarRow(value: unknown): value is BarRow {
  return typeof value === 'object' && value !== null && 'label' in value && 'text' in value;
}

/** Recharts hands the hovered datum back untyped: read it defensively. */
function Tip({ active, payload }: { active: boolean; payload: readonly unknown[] }) {
  const first = payload[0];
  const datum =
    typeof first === 'object' && first !== null && 'payload' in first ? first.payload : undefined;
  const row = isBarRow(datum) ? datum : undefined;
  if (!active || !row) return null;
  return (
    <div className="rounded-paper border-2 border-ink bg-paper px-2.5 py-1.5 font-mono text-data text-ink shadow-2">
      <p className="type-slug text-ink-3">{row.label}</p>
      <p className="mt-1 font-semibold">{row.text || 'nothing yet'}</p>
      {row.detail ? <p className="text-ink-2">{row.detail}</p> : null}
    </div>
  );
}

/**
 * Horizontal bars growing from a left baseline: one row per name, the figure printed at the end
 * of the bar. Ink axes at left and bottom only, bars no thicker than 24 px with a 4 px radius on
 * the data end. Lives in the Recharts chunk.
 */
export function HBarChart({
  rows,
  label,
  nameWidth = 64,
  barSize = 18,
  labelRoom = 84,
}: HBarChartProps) {
  const reduced = useReducedMotion();
  return (
    <div role="img" aria-label={label} className="h-full w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={rows as BarRow[]}
          layout="vertical"
          margin={{ top: 4, right: labelRoom, bottom: 0, left: 0 }}
          barCategoryGap={8}
        >
          <CartesianGrid horizontal={false} stroke="var(--color-line)" strokeWidth={1} />
          <XAxis
            type="number"
            domain={[0, 'auto']}
            tickFormatter={(value: number) => formatValue(value, 1)}
            tick={TICK}
            tickLine={false}
            axisLine={AXIS_LINE}
            tickCount={4}
            tickMargin={4}
            hide={rows.every((row) => row.value === 0)}
          />
          <YAxis
            type="category"
            dataKey="label"
            width={nameWidth}
            tick={{ ...TICK, fill: 'var(--color-ink)', fontWeight: 600 }}
            tickLine={false}
            axisLine={AXIS_LINE}
            interval={0}
          />
          <Tooltip
            cursor={{ fill: 'var(--color-mat-deep)', fillOpacity: 0.6 }}
            content={({ active, payload }) => <Tip active={active} payload={payload} />}
          />
          <Bar
            dataKey="value"
            barSize={barSize}
            radius={[0, 4, 4, 0]}
            isAnimationActive={!reduced}
            animationDuration={360}
          >
            {rows.map((row) => (
              <Cell key={row.id} fill={row.fill} />
            ))}
            <LabelList
              dataKey="text"
              position="right"
              offset={8}
              style={{ ...TICK, fill: 'var(--color-ink)', fontWeight: 600 }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
