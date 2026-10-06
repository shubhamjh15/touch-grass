'use client';

import { createContext, use, type FormEvent, type ReactNode, type RefObject } from 'react';
import { cn } from '@/lib/cn';

/**
 * Where the page keeps a handle on the current step's heading: when the step changes, focus
 * lands there, so a screen reader announces the new question and Tab starts at the top.
 */
export const StepHeadingContext = createContext<RefObject<HTMLHeadingElement | null> | null>(null);

export interface StepFrameProps {
  /** Mono line above the title: which part of the flow this is. */
  slug: string;
  /** Right of the slug: "3 / 7". */
  slugEnd?: ReactNode;
  title: ReactNode;
  /** Long questions are set a size smaller so they never crowd the desk. */
  titleSize?: 'h1' | 'h2';
  lead?: ReactNode;
  children?: ReactNode;
  /** The step's buttons. The first primary button should be `type="submit"`. */
  footer?: ReactNode;
  /** Enter in any field, or the submit button. */
  onSubmit?: () => void;
  className?: string;
}

/**
 * One screen of the flow on the desk: a slug, the question as the page's `h1`, the answer,
 * and the buttons. It is a form, so Enter always means "next".
 */
export function StepFrame({
  slug,
  slugEnd,
  title,
  titleSize = 'h1',
  lead,
  children,
  footer,
  onSubmit,
  className,
}: StepFrameProps) {
  const headingRef = use(StepHeadingContext);
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSubmit?.();
  };

  return (
    <form noValidate onSubmit={submit} className={cn('flex min-w-0 flex-1 flex-col', className)}>
      <header>
        <p className="flex items-center justify-between gap-3 type-slug text-ink-3">
          <span>{slug}</span>
          {slugEnd}
        </p>
        <h1
          ref={headingRef}
          tabIndex={-1}
          className={cn(
            'mt-2.5 text-balance text-ink outline-hidden focus-visible:shadow-none',
            titleSize === 'h1' ? 'text-h1' : 'text-h2',
          )}
        >
          {title}
        </h1>
        {lead ? <p className="mt-3 text-body text-pretty text-ink-2">{lead}</p> : null}
      </header>
      {children ? <div className="mt-6 flex flex-col gap-5">{children}</div> : null}
      {footer ? <StepActions>{footer}</StepActions> : null}
    </form>
  );
}

/** The row of buttons under a step: full width and stacked on a phone, right-aligned on a desk. */
export function StepActions({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        'mt-8 flex flex-col gap-3 sm:flex-row-reverse sm:items-center sm:justify-start',
        // On a phone the way on stays under the thumb, however long the screen is.
        'max-sm:sticky max-sm:bottom-0 max-sm:z-10 max-sm:-mx-(--gutter) max-sm:mt-6 max-sm:bg-linear-to-t max-sm:from-mat max-sm:from-75% max-sm:to-transparent max-sm:pt-5 max-sm:px-gutter max-sm:pb-[max(16px,var(--safe-b))]',
        className,
      )}
    >
      {children}
    </div>
  );
}
