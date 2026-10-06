'use client';

import type { LucideIcon } from 'lucide-react';
import type { ComponentProps, MouseEvent } from 'react';
import { cn } from '@/lib/cn';
import { Tooltip } from './Tooltip';

export type IconButtonVariant = 'neutral' | 'ghost' | 'primary' | 'reward' | 'info' | 'danger';

const OUTLINED = 'border-2 border-ink off:border-ink-4 off:bg-line';

const VARIANT: Record<IconButtonVariant, string> = {
  neutral: cn(OUTLINED, 'bg-white fine:hover:bg-mat-deep'),
  ghost: 'bg-transparent fine:hover:bg-mat-deep active:bg-mat-deep',
  primary: cn(OUTLINED, 'bg-green fine:hover:bg-primary-hover'),
  reward: cn(OUTLINED, 'bg-yellow fine:hover:bg-yellow-tint'),
  info: cn(OUTLINED, 'bg-white fine:hover:bg-mat-deep'),
  danger: cn(OUTLINED, 'bg-tomato fine:hover:bg-tomato-tint'),
};

export type IconButtonProps = Omit<ComponentProps<'button'>, 'children' | 'aria-label'> & {
  /** The accessible name, also shown as the tooltip. Verb first: "Undo", "Close". */
  label: string;
  icon: LucideIcon;
  /** `neutral` is outlined; `ghost` has no outline (close buttons, row actions). */
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
        'grid shrink-0 place-items-center text-ink transition-[transform,background-color] duration-(--dur-fast) ease-out active:translate-y-px off:translate-y-0 off:cursor-not-allowed off:text-ink-3',
        size === 'md' ? 'size-11' : 'hit-1 size-9',
        shape === 'round' ? 'rounded-full' : 'rounded-md',
        VARIANT[variant],
        className,
      )}
      onClick={handleClick}
      {...rest}
    >
      <Icon size={size === 'md' ? 20 : 18} strokeWidth={2} aria-hidden="true" />
    </button>
  );

  if (tooltipSide === null && !disabledReason) return button;
  return (
    <Tooltip content={disabledReason ?? label} side={tooltipSide ?? 'top'}>
      {button}
    </Tooltip>
  );
}
