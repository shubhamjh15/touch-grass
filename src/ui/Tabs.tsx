'use client';

import { Tabs as RadixTabs } from 'radix-ui';
import type { ComponentProps, ReactNode } from 'react';
import { cn } from '@/lib/cn';

export interface TabItem<T extends string = string> {
  value: T;
  label: string;
  /** Count after the label. */
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
 * Underlined tabs: the selected one is bold with an ink rule under it. Tabs swap what a panel
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
        className={cn(
          'scroll-row gap-6 shadow-[inset_0_-2px_0_0_var(--color-line)] [--row-pad:0px]',
          listClassName,
        )}
      >
        {tabs.map((tab) => (
          <RadixTabs.Trigger
            key={tab.value}
            value={tab.value}
            disabled={tab.disabled}
            className="inline-flex h-11 items-center gap-1.5 border-b-2 border-transparent text-body font-medium whitespace-nowrap text-ink-3 focus-inset disabled:cursor-not-allowed disabled:text-ink-4 data-[state=active]:border-ink data-[state=active]:font-bold data-[state=active]:text-ink fine:hover:text-ink"
          >
            {tab.label}
            {tab.count !== undefined ? (
              <span className="text-body-sm font-medium text-ink-3 tabular-nums">{tab.count}</span>
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
  /** Drop the card frame when the panel holds its own cards or rows. */
  bare?: boolean;
};

/** The panel of one tab. Focusable, so keyboard users land in its content. */
export function TabPanel({ value, bare = false, className, ...rest }: TabPanelProps) {
  return (
    <RadixTabs.Content
      value={value}
      className={cn(
        bare ? 'pt-5' : 'mt-5 rounded-lg border-2 border-ink bg-card p-5 md:p-6',
        className,
      )}
      {...rest}
    />
  );
}
