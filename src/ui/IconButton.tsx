'use client';

import type { LucideIcon } from 'lucide-react';
import type { ComponentProps, MouseEvent } from 'react';
import { cn } from '@/lib/cn';
import { Tooltip } from './Tooltip';

export type IconButtonVariant = 'neutral' | 'primary' | 'reward' | 'info' | 'danger';

const VARIANT: Record<IconButtonVariant, string> = {
  neutral: 'bg-white',
  primary: 'bg-green',
  reward: 'bg-yellow',
  info: 'bg-blue',
  danger: 'bg-tomato',
};

export type IconButtonProps = Omit<ComponentProps<'button'>, 'children' | 'aria-label'> & {
  /** The accessible name, also shown as the tooltip. Verb first: "Undo", "Close". */
  label: string;
  icon: LucideIcon;
  variant?: IconButtonVariant;
  size?: 'sm' | 'md';
  shape?: 'round' | 'square';
  /** Where the tooltip opens. Pass `null` to drop the tooltip when the label is visible nearby. */
  tooltipSide?: 'top' | 'right' | 'bottom' | 'left' | null;
  /** Stays focusable, does nothing, and the tooltip says why. */
  disabledReason?: string;
};

/** An icon-only control: always named, always at least a 44 px target. */
export function IconButton({
  label,
  icon: Icon,
  variant = 'neutral',
  size = 'md',
  shape = 'round',
  tooltipSide = 'top',
  disabledReason,
  className,
  onClick,
  type,
  ...rest
}: IconButtonProps) {
  const softDisabled = Boolean(disabledReason) && !rest.disabled;
  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    if (softDisabled) {
      event.preventDefault();
      return;
    }
    onClick?.(event);
  };

  const button = (
    <button
      type={type ?? 'button'}
      aria-label={label}
      aria-disabled={softDisabled || undefined}
      className={cn(
        'grid shrink-0 hard place-items-center border-3 border-ink text-ink lift-3',
        'off:border-2 off:border-dashed off:border-ink-4 off:bg-line off:text-ink-3',
        size === 'md' ? 'size-11' : 'hit-1 size-9',
        shape === 'round' ? 'rounded-full' : 'rounded-ctl',
        VARIANT[variant],
        className,
      )}
      onClick={handleClick}
      {...rest}
    >
      <Icon size={size === 'md' ? 20 : 16} strokeWidth={2.25} aria-hidden="true" />
    </button>
  );

  if (tooltipSide === null && !disabledReason) return button;
  return (
    <Tooltip content={disabledReason ?? label} side={tooltipSide ?? 'top'}>
      {button}
    </Tooltip>
  );
}
