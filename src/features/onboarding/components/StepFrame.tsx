'use client';

import { use, type FormEvent, type ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { StepHeadingContext } from './stepHeading';

export interface StepFrameProps {
  /** One quiet line above the question: "Question 2 of 5". */
  eyebrow?: string;
  /** The question, as the page's `h1`. Six words or fewer. */
  title: ReactNode;
  /** At most two lines under the question. */
  lead?: ReactNode;
  children?: ReactNode;
  /** The step's buttons: one primary (`type="submit"`), then anything quieter. */
  footer?: ReactNode;
  /** Enter in any field, or the submit button. */
  onSubmit?: () => void;
  className?: string;
}

/**
 * One screen of the flow: the question, the answer and the buttons, with nothing else. It is
 * a form, so Enter always means "continue". On a phone the buttons sit at the bottom of the
 * screen, within reach of a thumb; on a desk they follow the answer.
 */
export function StepFrame({
  eyebrow,
  title,
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
        {eyebrow ? <p className="mb-2 text-body-sm text-ink-3">{eyebrow}</p> : null}
        <h1 ref={headingRef} tabIndex={-1} className="text-h1 text-balance text-ink outline-hidden">
          {title}
        </h1>
        {lead ? <p className="mt-3 text-body text-pretty text-ink-2">{lead}</p> : null}
      </header>
      {children ? <div className="mt-8 flex flex-col gap-6">{children}</div> : null}
      {footer ? <StepActions>{footer}</StepActions> : null}
    </form>
  );
}

/** The buttons of a step, stacked and full width. */
export function StepActions({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('mt-auto flex flex-col gap-3 pt-8 sm:mt-10 sm:pt-0', className)}>
      {children}
    </div>
  );
}
