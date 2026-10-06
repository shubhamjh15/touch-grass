'use client';

import { Check, ChevronDown } from 'lucide-react';
import { Select as RadixSelect } from 'radix-ui';
import { cn } from '@/lib/cn';
import { useFieldControl } from './fieldContext';

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps {
  value: string | undefined;
  onValueChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  disabled?: boolean;
  invalid?: boolean;
  id?: string;
  /** Needed when the select is not inside a `Field`. */
  'aria-label'?: string;
  name?: string;
  className?: string;
}

/** A listbox on Radix Select: type-ahead, arrows, Home/End. The trigger looks like an input. */
export function Select({
  value,
  onValueChange,
  options,
  placeholder = 'Choose…',
  disabled,
  invalid,
  id,
  name,
  className,
  ...rest
}: SelectProps) {
  const { invalid: isInvalid, ...control } = useFieldControl({ id, invalid });
  return (
    <RadixSelect.Root value={value} onValueChange={onValueChange} disabled={disabled} name={name}>
      <RadixSelect.Trigger
        {...control}
        aria-label={rest['aria-label']}
        className={cn(
          'flex h-12 w-full items-center rounded-md border-2 border-ink bg-white text-left text-body text-ink data-disabled:cursor-not-allowed data-placeholder:text-ink-4 off:border-ink-4 off:bg-line off:text-ink-3',
          isInvalid && 'border-tomato-deep bg-tomato-tint',
          className,
        )}
      >
        <span className="min-w-0 flex-1 truncate px-3.5">
          <RadixSelect.Value placeholder={placeholder} />
        </span>
        <RadixSelect.Icon className="grid h-full w-11 shrink-0 place-items-center text-ink">
          <ChevronDown size={20} strokeWidth={1.75} aria-hidden="true" />
        </RadixSelect.Icon>
      </RadixSelect.Trigger>
      <RadixSelect.Portal>
        <RadixSelect.Content
          position="popper"
          sideOffset={8}
          collisionPadding={12}
          className="z-(--z-tooltip) max-h-80 min-w-(--radix-select-trigger-width) overflow-hidden rounded-md border-2 border-ink bg-card text-ink shadow-3 data-[state=open]:animate-stick"
        >
          <RadixSelect.Viewport className="max-h-[min(20rem,var(--radix-select-content-available-height))] p-1">
            {options.map((option) => (
              <RadixSelect.Item
                key={option.value}
                value={option.value}
                disabled={option.disabled}
                className="flex h-11 cursor-pointer items-center gap-2 rounded-sm px-3 text-body outline-hidden select-none data-disabled:cursor-not-allowed data-disabled:text-ink-4 data-highlighted:bg-mat-deep data-[state=checked]:font-bold"
              >
                <RadixSelect.ItemText>{option.label}</RadixSelect.ItemText>
                <RadixSelect.ItemIndicator className="ml-auto">
                  <Check size={18} strokeWidth={2.5} aria-hidden="true" />
                </RadixSelect.ItemIndicator>
              </RadixSelect.Item>
            ))}
          </RadixSelect.Viewport>
        </RadixSelect.Content>
      </RadixSelect.Portal>
    </RadixSelect.Root>
  );
}
