'use client';

import { Tabs as RadixTabs } from 'radix-ui';
import type { ComponentProps, ReactNode } from 'react';
import { cn } from '@/lib/cn';

export interface TabItem<T extends string = string> {
  value: T;
  label: string;
  /** Mono count after the label. */
  count?: number;
  disabled?: boolean;
}

export interface TabsProps<T extends string = string> {
  value: T;
  onValueChange: (value: T) => void;
  tabs: readonly TabItem<T>[];
  'aria-label': string;
  /** `TabPanel`s, one per tab value. */
  children: ReactNode;
  className?: string;
  listClassName?: string;
}

/**
 * Index tabs standing on a card: the selected tab joins the panel below. Tabs swap what a panel
 * contains (Chips filter it; Segmented picks a value). Arrow keys, Home and End move between tabs.
 */
export function Tabs<T extends string = string>({
  value,
  onValueChange,
  tabs,
  children,
  className,
  listClassName,
  ...rest
}: TabsProps<T>) {
  return (
    <RadixTabs.Root
      value={value}
      onValueChange={(next) => onValueChange(next as T)}
      className={className}
    >
      <RadixTabs.List
        aria-label={rest['aria-label']}
        className={cn('scroll-row z-1 gap-1', listClassName)}
      >
        {tabs.map((tab) => (
          <RadixTabs.Trigger
            key={tab.value}
            value={tab.value}
            disabled={tab.disabled}
            className="inline-flex h-10 items-center gap-1.5 rounded-t-ctl border-3 border-b-0 border-ink bg-mat-deep px-4 text-label whitespace-nowrap text-ink-2 focus-inset disabled:cursor-not-allowed disabled:text-ink-4 data-[state=active]:-mb-[3px] data-[state=active]:h-[43px] data-[state=active]:bg-card data-[state=active]:pb-[3px] data-[state=active]:font-bold data-[state=active]:text-ink fine:hover:text-ink"
          >
            {tab.label}
            {tab.count !== undefined ? (
              <span className="font-mono text-data font-medium text-ink-3">{tab.count}</span>
            ) : null}
          </RadixTabs.Trigger>
        ))}
      </RadixTabs.List>
      {children}
    </RadixTabs.Root>
  );
}

export type TabPanelProps = Omit<ComponentProps<'div'>, 'value'> & {
  value: string;
  /** Drop the card frame when the panel holds its own cards. */
  bare?: boolean;
};

/** The panel a tab stands on. Focusable, so keyboard users land in its content. */
export function TabPanel({ value, bare = false, className, ...rest }: TabPanelProps) {
  return (
    <RadixTabs.Content
      value={value}
      className={cn(
        bare
          ? 'border-t-3 border-ink pt-4'
          : 'rounded-md rounded-tl-none border-3 border-ink bg-card p-4 shadow-3 md:rounded-lg md:rounded-tl-none md:p-5',
        className,
      )}
      {...rest}
    />
  );
}
