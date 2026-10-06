'use client';

import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

/** One chapter of the workbench: an anchored section with a title and one line that states the rule. */
export function Chapter({
  id,
  title,
  rule,
  children,
}: {
  id: string;
  title: string;
  rule: string;
  children: ReactNode;
}) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="min-w-0 scroll-mt-24">
      <h2 id={`${id}-title`} className="text-h1">
        {title}
      </h2>
      <p className="mt-2 measure text-body text-ink-2">{rule}</p>
      <div className="mt-8 grid gap-10">{children}</div>
    </section>
  );
}

/** One example: a small title, an optional note, then the specimens in a wrapping row. */
export function Demo({
  title,
  note,
  className,
  children,
}: {
  title: string;
  note?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className="min-w-0">
      <h3 className="text-h4">{title}</h3>
      {note ? <p className="mt-1 measure text-body-sm text-ink-3">{note}</p> : null}
      <div className={cn('mt-4 flex flex-wrap items-start gap-x-4 gap-y-5', className)}>
        {children}
      </div>
    </div>
  );
}

/** A specimen with its name underneath. */
export function Spec({
  name,
  className,
  children,
}: {
  name: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <figure className={cn('flex flex-col items-center gap-2.5', className)}>
      {children}
      <figcaption className="text-center text-body-sm text-ink-3">{name}</figcaption>
    </figure>
  );
}
