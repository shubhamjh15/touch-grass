'use client';

import { Check } from 'lucide-react';
import { Switch as RadixSwitch } from 'radix-ui';
import { useId, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

export interface SwitchProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  /** Always visible; the whole row is the target. */
  label: ReactNode;
  description?: ReactNode;
  disabled?: boolean;
  /** Hide the label visually when a neighbouring ListRow already shows it. */
  hideLabel?: boolean;
  id?: string;
  className?: string;
}

/**
 * A chunky toggle. State is position plus a check in the thumb, never colour alone. It moves in
 * 140 ms with the mechanical easing: decisive, never bouncy.
 */
export function Switch({
  checked,
  onCheckedChange,
  label,
  description,
  disabled = false,
  hideLabel = false,
  id,
  className,
}: SwitchProps) {
  const autoId = useId();
  const controlId = id ?? `${autoId}-switch`;
  const labelId = `${autoId}-label`;
  const descriptionId = `${autoId}-description`;

  return (
    <div
      className={cn(
        'flex items-center gap-4',
        hideLabel ? 'inline-flex' : 'min-h-12 justify-between',
        className,
      )}
    >
      <label
        htmlFor={controlId}
        className={cn(
          'min-w-0 flex-1 py-1',
          hideLabel && 'sr-only',
          disabled && 'cursor-not-allowed',
        )}
      >
        <span
          id={labelId}
          className={cn('block text-body font-semibold', disabled ? 'text-ink-3' : 'text-ink')}
        >
          {label}
        </span>
        {description ? (
          <span id={descriptionId} className="mt-0.5 block text-body-sm text-ink-2">
            {description}
          </span>
        ) : null}
      </label>
      <RadixSwitch.Root
        id={controlId}
        checked={checked}
        onCheckedChange={onCheckedChange}
        disabled={disabled}
        aria-labelledby={labelId}
        aria-describedby={description ? descriptionId : undefined}
        className="hit-2 relative h-8 w-14 shrink-0 rounded-ctl border-3 border-ink bg-line transition-colors duration-(--dur-fast) ease-mech disabled:cursor-not-allowed disabled:border-2 disabled:border-dashed disabled:border-ink-4 data-[state=checked]:bg-green disabled:data-[state=checked]:bg-line"
      >
        <RadixSwitch.Thumb className="absolute top-0.5 left-0.5 grid size-[22px] place-items-center rounded-xs border-2 border-ink bg-white text-ink shadow-thumb transition-transform duration-(--dur-fast) ease-mech data-[state=checked]:translate-x-6 data-[state=checked]:shadow-thumb-on">
          {checked ? <Check size={12} strokeWidth={3.5} aria-hidden="true" /> : null}
        </RadixSwitch.Thumb>
      </RadixSwitch.Root>
    </div>
  );
}
