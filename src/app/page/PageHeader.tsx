import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export interface PageHeaderProps {
  /** The `h1` of the page. The shell moves focus here on navigation. */
  title: string;
  /** One line under the title. */
  subtitle?: string;
  /** A control that belongs to the whole page (a filter). Rarely needed. */
  children?: ReactNode;
  className?: string;
  /** @deprecated Use `subtitle`. */
  lead?: string;
  /** @deprecated No longer drawn. */
  slug?: string;
  /** @deprecated No longer drawn. */
  fill?: string;
  /** @deprecated No longer drawn. */
  grove?: boolean;
}

/** The top of a page: its name and, at most, one line about it. */
export function PageHeader({ title, subtitle, lead, children, className }: PageHeaderProps) {
  const line = subtitle ?? lead;
  return (
    <header className={cn('grid gap-2 pb-6 lg:pb-8', className)}>
      <h1
        tabIndex={-1}
        className="text-[1.75rem]/[2.125rem] font-bold tracking-[-0.02em] outline-hidden"
      >
        {title}
      </h1>
      {line ? <p className="max-w-[640px] text-body text-ink-2">{line}</p> : null}
      {children}
    </header>
  );
}
