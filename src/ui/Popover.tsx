'use client';

import { Popover as RadixPopover } from 'radix-ui';
import type { CSSProperties, ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { useBreakpoint } from '@/lib/hooks';
import { Sheet } from './Sheet';

export interface PopoverProps {
  /** The element that opens it. Must be focusable (a button). */
  trigger: ReactNode;
  /** `paper` is the warm surface: sources and chart tooltips. */
  tone?: 'card' | 'paper';
  /** Pixel width. */
  width?: number;
  side?: 'top' | 'right' | 'bottom' | 'left';
  align?: 'start' | 'center' | 'end';
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /**
   * A popover with more than three rows becomes a bottom Sheet below `md`. Passing a title opts in
   * and names that sheet.
   */
  sheetTitle?: string;
  /** Accessible name of the popover when it has no visible heading. */
  label?: string;
  className?: string;
  children: ReactNode;
}

/** A small panel anchored to its trigger. Esc and an outside press close it; focus returns. */
export function Popover({
  trigger,
  tone = 'card',
  width = 300,
  side = 'bottom',
  align = 'start',
  open,
  onOpenChange,
  sheetTitle,
  label,
  className,
  children,
}: PopoverProps) {
  const wide = useBreakpoint('md');

  if (sheetTitle && !wide) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange} trigger={trigger} title={sheetTitle}>
        {children}
      </Sheet>
    );
  }

  return (
    <RadixPopover.Root open={open} onOpenChange={onOpenChange}>
      <RadixPopover.Trigger asChild>{trigger}</RadixPopover.Trigger>
      <RadixPopover.Portal>
        <RadixPopover.Content
          side={side}
          align={align}
          sideOffset={8}
          collisionPadding={12}
          aria-label={label}
          className={cn(
            'z-(--z-tooltip) max-w-[calc(100vw-24px)] rounded-md border-2 border-ink p-4 text-ink shadow-3 outline-hidden data-[state=closed]:animate-peel data-[state=open]:animate-stick',
            tone === 'paper' ? 'bg-paper' : 'bg-card',
            className,
          )}
          style={{ width } as CSSProperties}
        >
          {children}
        </RadixPopover.Content>
      </RadixPopover.Portal>
    </RadixPopover.Root>
  );
}
