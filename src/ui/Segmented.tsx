'use client';

import type { LucideIcon } from 'lucide-react';
import { ToggleGroup } from 'radix-ui';
import { cn } from '@/lib/cn';

export interface SegmentedOption<T extends string = string> {
  value: T;
  label: string;
  icon?: LucideIcon;
  disabled?: boolean;
}

export interface SegmentedProps<T extends string = string> {
  value: T;
  onValueChange: (value: T) => void;
  /** 2–5 options. */
  options: readonly SegmentedOption<T>[];
  size?: 'sm' | 'md';
  fullWidth?: boolean;
  disabled?: boolean;
  'aria-label': string;
  className?: string;
}

/**
 * Picks one value from a short set (quantity presets are always a Segmented). Arrow keys move
 * between options; one is always selected.
 */
export function Segmented<T extends string = string>({
  value,
  onValueChange,
  options,
  size = 'md',
  fullWidth = false,
  disabled,
  className,
  ...rest
}: SegmentedProps<T>) {
  return (
    <ToggleGroup.Root
      type="single"
      value={value}
      onValueChange={(next) => {
        // Radix clears the value when the active item is pressed again; a Segmented always has one.
        if (next) onValueChange(next as T);
      }}
      disabled={disabled}
      aria-label={rest['aria-label']}
      className={cn(
        'inline-flex max-w-full gap-0.5 rounded-md border-2 border-ink bg-white p-0.5 text-body-sm font-semibold text-ink',
        fullWidth && 'flex w-full',
        className,
      )}
    >
      {options.map(({ value: optionValue, label, icon: Icon, disabled: optionDisabled }) => (
        <ToggleGroup.Item
          key={optionValue}
          value={optionValue}
          disabled={optionDisabled}
          className={cn(
            'inline-flex min-w-0 items-center justify-center gap-1.5 rounded-sm px-3.5 whitespace-nowrap focus-inset transition-colors duration-(--dur-fast) disabled:cursor-not-allowed disabled:text-ink-4 data-[state=on]:bg-ink data-[state=on]:text-white fine:hover:bg-mat-deep fine:data-[state=on]:hover:bg-ink',
            size === 'md' ? 'h-10' : 'h-8 px-3',
            fullWidth && 'flex-1',
          )}
        >
          {Icon ? <Icon size={16} strokeWidth={2} aria-hidden="true" /> : null}
          <span className="truncate">{label}</span>
        </ToggleGroup.Item>
      ))}
    </ToggleGroup.Root>
  );
}
