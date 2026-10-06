'use client';

import { useId, type ComponentProps, type ElementType, type ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { SectionHeading } from './headings';
import { looseTag } from './polymorphic';

const WIDTH = {
  /** 1120 px: a page. */
  page: 'max-w-(--content-max)',
  /** 640 px: a reading column or a simple list. */
  reading: 'max-w-(--measure)',
  /** 480 px: one question at a time. */
  narrow: 'max-w-[30rem]',
} as const;

export type PageContainerProps = ComponentProps<'div'> & {
  width?: keyof typeof WIDTH;
  /** Lays the direct children out as sections, 40 px apart (56 px from `md`). */
  sections?: boolean;
  /** Top and bottom padding. Turn off when the shell already provides it. */
  padded?: boolean;
  as?: ElementType;
};

/** The page box: centred, capped in width, with the side gutters (and the safe areas) applied. */
export function PageContainer({
  width = 'page',
  sections = false,
  padded = true,
  as = 'div',
  className,
  ...rest
}: PageContainerProps) {
  const Comp = looseTag(as);
  return (
    <Comp
      className={cn(
        'mx-auto w-full px-gutter',
        WIDTH[width],
        padded && 'py-6 md:py-10',
        sections && 'stack-sections',
        className,
      )}
      {...rest}
    />
  );
}

export type SectionProps = Omit<ComponentProps<'section'>, 'title'> & {
  title: string;
  /** One quiet line beside the title: "Resets in 9 h". */
  meta?: string;
  /** A text link beside the title: "See all". */
  action?: { label: string; href: string };
  /** Heading level of the title. */
  headingLevel?: 'h2' | 'h3';
  children: ReactNode;
};

/** One section of a page: a labelled region with its heading. Put several in a `PageContainer sections`. */
export function Section({
  title,
  meta,
  action,
  headingLevel = 'h2',
  className,
  children,
  ...rest
}: SectionProps) {
  const id = useId();
  return (
    <section aria-labelledby={id} className={cn('min-w-0', className)} {...rest}>
      <SectionHeading
        headingId={id}
        title={title}
        meta={meta}
        action={action}
        as={headingLevel}
        className="mt-0"
      />
      {children}
    </section>
  );
}
