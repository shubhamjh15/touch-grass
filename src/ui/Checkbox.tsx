'use client';

import { Check } from 'lucide-react';
import { Checkbox as RadixCheckbox, RadioGroup as RadixRadioGroup } from 'radix-ui';
import { useId, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

export interface CheckboxProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  label: ReactNode;
  description?: ReactNode;
  disabled?: boolean;
  id?: string;
  className?: string;
}

/** A debossed box that fills green with an ink check. The whole row (min 44 px) is the target. */
export function Checkbox({
  checked,
  onCheckedChange,
  label,
  description,
  disabled = false,
  id,
  className,
}: CheckboxProps) {
  const autoId = useId();
  const controlId = id ?? `${autoId}-checkbox`;
  return (
    <div className={cn('flex min-h-11 items-start gap-3 py-2.5', className)}>
      <RadixCheckbox.Root
        id={controlId}
        checked={checked}
        onCheckedChange={(next) => onCheckedChange(next === true)}
        disabled={disabled}
        className="hit-2 grid size-6 shrink-0 place-items-center rounded-xs border-3 border-ink bg-white text-ink deboss transition-colors duration-(--dur-fast) disabled:cursor-not-allowed disabled:border-2 disabled:border-dashed disabled:border-ink-4 disabled:bg-line data-[state=checked]:bg-green data-[state=checked]:[--deboss:transparent]"
      >
        <RadixCheckbox.Indicator>
          <Check size={16} strokeWidth={3} aria-hidden="true" className="animate-pop" />
        </RadixCheckbox.Indicator>
      </RadixCheckbox.Root>
      <label
        htmlFor={controlId}
        className={cn('min-w-0 flex-1', disabled && 'cursor-not-allowed text-ink-3')}
      >
        <span className="block text-body">{label}</span>
        {description ? (
          <span className="mt-0.5 block text-body-sm text-ink-2">{description}</span>
        ) : null}
      </label>
    </div>
  );
}

export interface RadioOption {
  value: string;
  label: ReactNode;
  description?: ReactNode;
  disabled?: boolean;
}

export interface RadioGroupProps {
  value: string | undefined;
  onValueChange: (value: string) => void;
  options: RadioOption[];
  'aria-label': string;
  orientation?: 'vertical' | 'horizontal';
  disabled?: boolean;
  name?: string;
  className?: string;
}

/** One choice from a short list. Selected = a yellow disc with an ink dot. Arrow keys move. */
export function RadioGroup({
  value,
  onValueChange,
  options,
  orientation = 'vertical',
  disabled,
  name,
  className,
  ...rest
}: RadioGroupProps) {
  const groupId = useId();
  return (
    <RadixRadioGroup.Root
      value={value}
      onValueChange={onValueChange}
      orientation={orientation}
      disabled={disabled}
      name={name}
      aria-label={rest['aria-label']}
      className={cn(
        'flex',
        orientation === 'vertical' ? 'flex-col' : 'flex-wrap gap-x-6',
        className,
      )}
    >
      {options.map((option) => {
        const id = `${groupId}-${option.value}`;
        const off = disabled || option.disabled;
        return (
          <div key={option.value} className="flex min-h-11 items-start gap-3 py-2.5">
            <RadixRadioGroup.Item
              id={id}
              value={option.value}
              disabled={option.disabled}
              className="hit-2 grid size-6 shrink-0 place-items-center rounded-full border-3 border-ink bg-white deboss transition-colors duration-(--dur-fast) disabled:cursor-not-allowed disabled:border-2 disabled:border-dashed disabled:border-ink-4 disabled:bg-line data-[state=checked]:bg-yellow data-[state=checked]:[--deboss:transparent]"
            >
              <RadixRadioGroup.Indicator className="block size-2.5 animate-pop rounded-full bg-ink" />
            </RadixRadioGroup.Item>
            <label
              htmlFor={id}
              className={cn('min-w-0 flex-1', off && 'cursor-not-allowed text-ink-3')}
            >
              <span className="block text-body">{option.label}</span>
              {option.description ? (
                <span className="mt-0.5 block text-body-sm text-ink-2">{option.description}</span>
              ) : null}
            </label>
          </div>
        );
      })}
    </RadixRadioGroup.Root>
  );
}
