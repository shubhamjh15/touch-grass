'use client';

import type { LucideIcon } from 'lucide-react';
import { DropdownMenu as RadixMenu } from 'radix-ui';
import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { UiLink } from './Link';

export interface MenuItem {
  /** Stable key; defaults to the label. */
  id?: string;
  label: string;
  icon?: LucideIcon;
  /** A quiet hint on the right (a count, a shortcut). */
  hint?: ReactNode;
  onSelect?: () => void;
  /** Renders the item as a link. */
  href?: string;
  /** Marks the current page. */
  current?: boolean;
  /** Destructive items sit last, after a rule, in tomato-deep. */
  danger?: boolean;
  disabled?: boolean;
}

export interface DropdownMenuProps {
  /** The button that opens the menu. */
  trigger: ReactNode;
  items: MenuItem[];
  /** Accessible name of the menu. */
  label: string;
  side?: 'top' | 'right' | 'bottom' | 'left';
  align?: 'start' | 'center' | 'end';
  className?: string;
}

const ITEM =
  'flex h-11 cursor-pointer items-center gap-3 rounded-sm px-3 text-body font-medium text-ink outline-hidden select-none data-disabled:cursor-not-allowed data-disabled:text-ink-4 data-highlighted:bg-mat-deep';

/** A short menu of actions or links (stop, retry and clear in the coach). Arrows, type-ahead and Esc from Radix. */
export function DropdownMenu({
  trigger,
  items,
  label,
  side = 'bottom',
  align = 'end',
  className,
}: DropdownMenuProps) {
  return (
    <RadixMenu.Root>
      <RadixMenu.Trigger asChild>{trigger}</RadixMenu.Trigger>
      <RadixMenu.Portal>
        <RadixMenu.Content
          aria-label={label}
          side={side}
          align={align}
          sideOffset={8}
          collisionPadding={12}
          className={cn(
            'z-(--z-tooltip) min-w-48 rounded-md border-2 border-ink bg-card p-1 shadow-3 data-[state=closed]:animate-peel data-[state=open]:animate-stick',
            className,
          )}
        >
          {items.map((item) => {
            const Icon = item.icon;
            const content = (
              <>
                {Icon ? <Icon size={20} strokeWidth={1.75} aria-hidden="true" /> : null}
                <span className="min-w-0 flex-1 truncate">{item.label}</span>
                {item.hint ? (
                  <span className="text-body-sm text-ink-3 tabular-nums">{item.hint}</span>
                ) : null}
              </>
            );
            const itemClass = cn(
              ITEM,
              item.current && 'bg-mat-deep font-bold',
              item.danger && 'text-tomato-deep',
            );
            return item.href ? (
              <RadixMenu.Item
                key={item.id ?? item.label}
                asChild
                disabled={item.disabled}
                onSelect={item.onSelect}
              >
                <UiLink
                  href={item.href}
                  aria-current={item.current ? 'page' : undefined}
                  className={itemClass}
                >
                  {content}
                </UiLink>
              </RadixMenu.Item>
            ) : (
              <RadixMenu.Item
                key={item.id ?? item.label}
                disabled={item.disabled}
                onSelect={item.onSelect}
                className={itemClass}
              >
                {content}
              </RadixMenu.Item>
            );
          })}
        </RadixMenu.Content>
      </RadixMenu.Portal>
    </RadixMenu.Root>
  );
}
