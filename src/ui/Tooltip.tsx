'use client';

import { Tooltip as RadixTooltip } from 'radix-ui';
import type { ReactElement } from 'react';
import { cn } from '@/lib/cn';

export interface TooltipProps {
  /** One short phrase. Never essential or interactive content: tooltips do not exist on touch. */
  content: string;
  side?: 'top' | 'right' | 'bottom' | 'left';
  align?: 'start' | 'center' | 'end';
  /** Milliseconds before it opens. */
  delay?: number;
  /** Turns the tooltip off without unwrapping the trigger. */
  disabled?: boolean;
  className?: string;
  /** A single focusable element. */
  children: ReactElement;
}

/** The ink label that explains an icon-only control or says why something is unavailable. */
export function Tooltip({
  content,
  side = 'top',
  align = 'center',
  delay = 400,
  disabled = false,
  className,
  children,
}: TooltipProps) {
  if (disabled || !content) return children;
  return (
    <RadixTooltip.Provider delayDuration={delay} skipDelayDuration={200}>
      <RadixTooltip.Root>
        <RadixTooltip.Trigger asChild>{children}</RadixTooltip.Trigger>
        <RadixTooltip.Portal>
          <RadixTooltip.Content
            side={side}
            align={align}
            sideOffset={10}
            collisionPadding={8}
            className={cn(
              'z-(--z-tooltip) max-w-60 rounded-sm bg-ink px-2.5 py-1.5 text-caption font-semibold text-white shadow-tooltip select-none',
              className,
            )}
          >
            {content}
          </RadixTooltip.Content>
        </RadixTooltip.Portal>
      </RadixTooltip.Root>
    </RadixTooltip.Provider>
  );
}
