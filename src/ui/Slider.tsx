'use client';

import { Slider as RadixSlider } from 'radix-ui';
import { useId } from 'react';
import { cn } from '@/lib/cn';
import { formatNumber } from '@/lib/format';
import { useFieldControl } from './fieldContext';

export interface SliderProps {
  value: number;
  onValueChange: (value: number) => void;
  min: number;
  max: number;
  step?: number;
  /** Values that get a tick under the track. */
  marks?: number[];
  /** Visible label and accessible name. */
  label: string;
  /** Formats the printed and spoken value: `(n) => `${n} km``. */
  format?: (value: number) => string;
  /** Called once per mark crossed, so the caller can play the `tick` sound. */
  onMarkCross?: () => void;
  disabled?: boolean;
  className?: string;
}

/** A debossed track with a chunky thumb. Arrows ±1 step, PageUp/PageDown ±10 steps, Home/End. */
export function Slider({
  value,
  onValueChange,
  min,
  max,
  step = 1,
  marks,
  label,
  format = formatNumber,
  onMarkCross,
  disabled,
  className,
}: SliderProps) {
  const labelId = useId();
  const control = useFieldControl({});
  const span = Math.max(max - min, 1);

  const handleChange = ([next]: number[]) => {
    if (next === undefined || next === value) return;
    if (onMarkCross && marks) {
      const low = Math.min(value, next);
      const high = Math.max(value, next);
      const crossed = marks.filter((mark) => mark > low && mark <= high).length;
      for (let index = 0; index < crossed; index += 1) onMarkCross();
    }
    onValueChange(next);
  };

  return (
    <div className={cn('min-w-0', className)}>
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <span id={labelId} className="text-label text-ink">
          {label}
        </span>
        <output className="font-mono text-data-lg text-ink">{format(value)}</output>
      </div>
      <RadixSlider.Root
        value={[value]}
        onValueChange={handleChange}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        className="relative flex h-11 touch-none items-center select-none data-disabled:opacity-60"
      >
        <RadixSlider.Track className="relative h-4 grow overflow-hidden rounded-pill border-2 border-ink bg-white inset-shadow-deboss">
          <RadixSlider.Range className="absolute h-full border-r-2 border-ink bg-green" />
        </RadixSlider.Track>
        <RadixSlider.Thumb
          aria-labelledby={labelId}
          aria-describedby={control['aria-describedby']}
          aria-valuetext={format(value)}
          className="block size-7 hard cursor-grab rounded-ctl border-3 border-ink bg-white lift-2 active:cursor-grabbing"
        />
      </RadixSlider.Root>
      {marks && marks.length > 0 ? (
        <div aria-hidden="true" className="relative mx-3.5 -mt-1.5 h-5">
          {marks.map((mark) => (
            <span
              key={mark}
              className="absolute top-0 flex -translate-x-1/2 flex-col items-center gap-1"
              style={{ left: `${((mark - min) / span) * 100}%` }}
            >
              <span className="h-1.5 w-0.5 bg-ink" />
              <span className="type-tick whitespace-nowrap text-ink-3">{format(mark)}</span>
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}
