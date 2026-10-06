'use client';

import { ChevronDown } from 'lucide-react';
import { Accordion as RadixAccordion, Collapsible } from 'radix-ui';
import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export interface AccordionItem {
  id: string;
  title: string;
  content: ReactNode;
}

export interface AccordionProps {
  items: readonly AccordionItem[];
  /** `single`: opening one closes the other. `multiple`: each opens on its own. */
  type?: 'single' | 'multiple';
  /** Ids open at first. With `single`, only the first one counts. */
  defaultOpen?: readonly string[];
  /** Heading level of the item titles. */
  headingLevel?: 'h2' | 'h3' | 'h4';
  className?: string;
}

const TRIGGER =
  'group/trigger flex min-h-14 w-full items-center justify-between gap-4 px-5 py-4 text-left text-body font-semibold text-ink focus-inset fine:hover:bg-mat';

const CHEVRON =
  'shrink-0 text-ink-3 transition-transform duration-(--dur-fast) ease-out group-data-[state=open]/trigger:rotate-180';

/**
 * Questions and answers, myths and truths: one card of rows that open in place. Closed content is
 * not rendered. Arrow keys move between the headers; Enter and Space open them.
 */
export function Accordion({
  items,
  type = 'single',
  defaultOpen = [],
  headingLevel: Heading = 'h3',
  className,
}: AccordionProps) {
  const rows = items.map((item) => (
    <RadixAccordion.Item key={item.id} value={item.id}>
      <RadixAccordion.Header asChild>
        <Heading>
          <RadixAccordion.Trigger className={TRIGGER}>
            {item.title}
            <ChevronDown size={20} strokeWidth={1.75} aria-hidden="true" className={CHEVRON} />
          </RadixAccordion.Trigger>
        </Heading>
      </RadixAccordion.Header>
      <RadixAccordion.Content className="px-5 pb-5 text-body text-ink-2 data-[state=open]:animate-fade-in">
        {item.content}
      </RadixAccordion.Content>
    </RadixAccordion.Item>
  ));

  const frame = cn(
    'divide-y divide-line overflow-hidden rounded-lg border-2 border-ink bg-card',
    className,
  );

  if (type === 'multiple') {
    return (
      <RadixAccordion.Root type="multiple" defaultValue={[...defaultOpen]} className={frame}>
        {rows}
      </RadixAccordion.Root>
    );
  }
  return (
    <RadixAccordion.Root type="single" collapsible defaultValue={defaultOpen[0]} className={frame}>
      {rows}
    </RadixAccordion.Root>
  );
}

export interface DisclosureProps {
  /** The always-visible line: "Logged today", "The bigger picture", "Sources". */
  title: string;
  /** A count after the title: "Logged today (2)". */
  count?: number;
  defaultOpen?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Draws the card frame around the row and its content. */
  framed?: boolean;
  className?: string;
  children: ReactNode;
}

/** One collapsed section: a row that opens what is behind it. Closed content is not rendered. */
export function Disclosure({
  title,
  count,
  defaultOpen = false,
  open,
  onOpenChange,
  framed = false,
  className,
  children,
}: DisclosureProps) {
  return (
    <Collapsible.Root
      open={open}
      defaultOpen={defaultOpen}
      onOpenChange={onOpenChange}
      className={cn(framed && 'overflow-hidden rounded-lg border-2 border-ink bg-card', className)}
    >
      <Collapsible.Trigger
        className={cn(
          'group/trigger flex min-h-11 w-full items-center justify-between gap-4 text-left text-body font-semibold text-ink',
          framed ? 'px-5 py-4 focus-inset fine:hover:bg-mat' : 'rounded-sm',
        )}
      >
        <span>
          {title}
          {count === undefined ? null : (
            <span className="font-normal text-ink-3 tabular-nums"> ({count})</span>
          )}
        </span>
        <ChevronDown size={20} strokeWidth={1.75} aria-hidden="true" className={CHEVRON} />
      </Collapsible.Trigger>
      <Collapsible.Content
        className={cn('data-[state=open]:animate-fade-in', framed ? 'px-5 pb-5' : 'pt-3')}
      >
        {children}
      </Collapsible.Content>
    </Collapsible.Root>
  );
}
