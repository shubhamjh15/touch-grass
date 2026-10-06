'use client';

import { Check, type LucideIcon } from 'lucide-react';
import { Slot } from 'radix-ui';
import type { ComponentProps, MouseEvent } from 'react';
import { cn } from '@/lib/cn';
import { Spinner } from './Spinner';
import { Tooltip } from './Tooltip';

/**
 * Three levels: `primary` (one per screen), `secondary` and `link`. `danger` is the destructive
 * confirmation, `reward` a claim, `ink` a button on a tinted band. `neutral`, `info` and `ghost` are
 * the earlier names of `secondary` and `link`.
 */
export type ButtonVariant =
  'primary' | 'secondary' | 'link' | 'reward' | 'ink' | 'danger' | 'neutral' | 'info' | 'ghost';
export type ButtonSize = 'sm' | 'md' | 'lg';

const BASE =
  'relative inline-flex items-center justify-center gap-2 whitespace-nowrap text-ink select-none aria-busy:pointer-events-none';

const SOLID =
  'rounded-md border-2 border-ink transition-[transform,background-color] duration-(--dur-fast) ease-out off:cursor-not-allowed off:border-ink-4 off:bg-line off:text-ink-3';

/** A flat button has no shadow to press into, so it dips by a pixel instead. */
const FLAT = 'active:translate-y-px off:translate-y-0';

const SECONDARY = cn(FLAT, 'bg-white off:hover:bg-line fine:hover:bg-mat-deep');

const VARIANT: Record<Exclude<ButtonVariant, 'link' | 'ghost'>, string> = {
  primary: 'hard bg-green lift-3 fine:hover:bg-primary-hover off:hover:bg-line',
  secondary: SECONDARY,
  neutral: SECONDARY,
  info: SECONDARY,
  reward: cn(FLAT, 'bg-yellow off:hover:bg-line fine:hover:bg-yellow-tint'),
  ink: cn(FLAT, 'bg-ink text-white off:hover:bg-line fine:hover:bg-ink-2'),
  danger: cn(FLAT, 'bg-tomato off:hover:bg-line fine:hover:bg-tomato-tint'),
};

const LINK =
  'rounded-xs underline-offset-4 decoration-2 fine:hover:underline active:underline off:cursor-not-allowed off:text-ink-3 off:no-underline';

const SIZE: Record<ButtonSize, string> = {
  sm: 'hit-1 h-9 px-3.5 text-button-sm',
  md: 'h-12 px-5 text-button',
  lg: 'h-14 px-7 text-button-lg',
};

const LINK_SIZE: Record<ButtonSize, string> = {
  sm: 'h-11 px-1 text-button-sm',
  md: 'h-11 px-1 text-button',
  lg: 'h-12 px-1 text-button-lg',
};

const ICON_SIZE: Record<ButtonSize, number> = { sm: 16, md: 20, lg: 20 };

export type ButtonProps = ComponentProps<'button'> & {
  variant?: ButtonVariant;
  /** `md` is 48 px. `lg` (56 px) is for the one main call to action of a screen. */
  size?: ButtonSize;
  /** Leading icon: actions. */
  icon?: LucideIcon;
  /** Trailing icon: navigation takes an `ArrowRight`. */
  iconRight?: LucideIcon;
  /** Busy: a spinner covers the label, the width never changes and presses are ignored. */
  loading?: boolean;
  /** The success beat: the fill turns green and a check lands. The caller times it. */
  success?: boolean;
  fullWidth?: boolean;
  /** Keeps the button focusable while unavailable and explains why in a tooltip (preferred over `disabled`). */
  disabledReason?: string;
  /** Render the child element (a link) with the button's look. */
  asChild?: boolean;
};

/** The pressable thing. One `primary` per screen; the label says what happens, in sentence case. */
export function Button({
  variant = 'secondary',
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
  const isLink = variant === 'link' || variant === 'ghost';

  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    if (softDisabled || loading) {
      event.preventDefault();
      return;
    }
    onClick?.(event);
  };

  let leading = null;
  if (success) {
    leading = (
      <Check size={iconSize} strokeWidth={2.5} aria-hidden="true" className="animate-pop" />
    );
  } else if (Icon) {
    leading = <Icon size={iconSize} strokeWidth={2} aria-hidden="true" />;
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
        isLink
          ? [LINK, LINK_SIZE[size]]
          : [SOLID, SIZE[size], VARIANT[variant], success && 'bg-green text-ink'],
        // The label keeps its place under the spinner, so the button never changes width.
        loading && 'text-transparent',
        fullWidth && 'w-full',
        className,
      )}
      onClick={handleClick}
      {...rest}
    >
      {leading}
      <Slot.Slottable>{children}</Slot.Slottable>
      {IconRight ? <IconRight size={iconSize} strokeWidth={2} aria-hidden="true" /> : null}
      {loading ? (
        <span aria-hidden="true" className="absolute inset-0 grid place-items-center">
          <Spinner
            size={size === 'sm' ? 16 : 20}
            label=""
            className={variant === 'ink' ? 'text-white' : 'text-ink'}
          />
        </span>
      ) : null}
    </Comp>
  );

  return disabledReason ? <Tooltip content={disabledReason}>{button}</Tooltip> : button;
}
