'use client';

import { Check, type LucideIcon } from 'lucide-react';
import { Slot } from 'radix-ui';
import type { ComponentProps, MouseEvent } from 'react';
import { cn } from '@/lib/cn';
import { ColorBar } from './ColorBar';
import { Tooltip } from './Tooltip';

export type ButtonVariant = 'primary' | 'reward' | 'neutral' | 'info' | 'ink' | 'danger' | 'ghost';
export type ButtonSize = 'sm' | 'md' | 'lg';

const BASE =
  'inline-flex items-center justify-center gap-2 whitespace-nowrap text-ink select-none aria-busy:pointer-events-none';

const EMBOSSED =
  'hard border-3 border-ink off:border-2 off:border-dashed off:border-ink-4 off:bg-line off:text-ink-3';

const VARIANT: Record<Exclude<ButtonVariant, 'ghost'>, string> = {
  primary: 'bg-green',
  reward: 'bg-yellow',
  neutral: 'bg-white',
  info: 'bg-blue',
  ink: 'bg-ink text-white [--color-shadow:var(--color-green)]',
  danger: 'bg-tomato',
};

const GHOST =
  'rounded-sm underline decoration-2 underline-offset-4 fine:hover:bg-yellow-tint active:bg-yellow/50 off:cursor-not-allowed off:text-ink-3 off:no-underline off:hover:bg-transparent';

const SIZE: Record<ButtonSize, string> = {
  sm: 'hit-1 h-9 rounded-sm px-3 text-button-sm lift-3',
  md: 'h-12 rounded-ctl px-5 text-button lift-5',
  lg: 'h-14 rounded-md px-[26px] text-button-lg lift-5',
};

const GHOST_SIZE: Record<ButtonSize, string> = {
  sm: 'h-11 px-2 text-button-sm',
  md: 'h-11 px-2 text-button',
  lg: 'h-12 px-2 text-button-lg',
};

const ICON_SIZE: Record<ButtonSize, number> = { sm: 16, md: 20, lg: 20 };
const STRIP = ['bg-green', 'bg-blue', 'bg-yellow', 'bg-pink', 'bg-ink'] as const;

export type ButtonProps = ComponentProps<'button'> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Leading icon: actions. */
  icon?: LucideIcon;
  /** Trailing icon: navigation takes an `ArrowRight`. */
  iconRight?: LucideIcon;
  /** Held halfway: the leading icon becomes the colour-bar loader; label and width never change. */
  loading?: boolean;
  /** The 600 ms success beat: the fill turns green and a check sticks in. The caller times it. */
  success?: boolean;
  fullWidth?: boolean;
  /** Keeps the button focusable while unavailable and explains why in a tooltip (preferred over `disabled`). */
  disabledReason?: string;
  /** Render the child element (a link) with the button's look. */
  asChild?: boolean;
};

/** The pressable thing. One `primary` per view; labels are verb-first, at most three words, sentence case. */
export function Button({
  variant = 'neutral',
  size = 'md',
  icon: Icon,
  iconRight: IconRight,
  loading = false,
  success = false,
  fullWidth = false,
  disabledReason,
  asChild = false,
  className,
  children,
  onClick,
  type,
  disabled,
  ...rest
}: ButtonProps) {
  const Comp = asChild ? Slot.Root : 'button';
  const softDisabled = Boolean(disabledReason) && !disabled;
  const iconSize = ICON_SIZE[size];

  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    if (softDisabled || loading) {
      event.preventDefault();
      return;
    }
    onClick?.(event);
  };

  let leading = null;
  if (loading && Icon) {
    leading = (
      <span className="grid size-5 place-items-center" aria-hidden="true">
        <ColorBar loading size="xs" label="" />
      </span>
    );
  } else if (success) {
    leading = <Check size={iconSize} strokeWidth={3} aria-hidden="true" className="animate-pop" />;
  } else if (Icon) {
    leading = <Icon size={iconSize} strokeWidth={2.25} aria-hidden="true" />;
  }

  const button = (
    <Comp
      type={asChild ? undefined : (type ?? 'button')}
      disabled={asChild ? undefined : disabled}
      aria-disabled={softDisabled || (asChild && disabled) ? true : undefined}
      aria-busy={loading || undefined}
      data-variant={variant}
      className={cn(
        BASE,
        variant === 'ghost'
          ? [GHOST, GHOST_SIZE[size]]
          : [
              EMBOSSED,
              SIZE[size],
              VARIANT[variant],
              success && 'bg-green text-ink',
              loading && 'translate-0.5 [--lift:3px]',
            ],
        loading && !Icon && 'relative overflow-hidden',
        fullWidth && 'w-full',
        className,
      )}
      onClick={handleClick}
      {...rest}
    >
      {leading}
      <Slot.Slottable>{children}</Slot.Slottable>
      {IconRight ? <IconRight size={iconSize} strokeWidth={2.25} aria-hidden="true" /> : null}
      {loading && !Icon ? (
        <span
          aria-hidden="true"
          className="absolute inset-x-0 bottom-0 flex h-1.5 animate-colorbar border-t-2 border-ink bg-white"
        >
          {STRIP.map((ink, index) => (
            <span
              key={ink}
              className={cn('flex-1', ink)}
              style={{ opacity: `clamp(0, calc(var(--bar) - ${index}), 1)` }}
            />
          ))}
        </span>
      ) : null}
    </Comp>
  );

  return disabledReason ? <Tooltip content={disabledReason}>{button}</Tooltip> : button;
}
