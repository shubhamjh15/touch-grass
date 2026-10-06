'use client';

import { useId, type ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { Ledger } from '@/ui';

/**
 * One row of a settings ledger: the name and a plain sentence on the left, the control on the
 * right (below the words on a phone). `stack` keeps a wide control, such as a row of chips,
 * under the words at every width. `message` is an inline result or error, announced politely.
 */
export function SettingRow({
  title,
  hint,
  message,
  stack = false,
  children,
}: {
  title: string;
  hint?: string;
  message?: ReactNode;
  stack?: boolean;
  children: (labelId: string) => ReactNode;
}) {
  const labelId = useId();
  return (
    <li
      className={cn(
        'grid gap-2.5 bg-card px-4 py-3.5',
        !stack && 'sm:grid-cols-[minmax(0,1fr)_minmax(0,auto)] sm:items-center sm:gap-6',
      )}
    >
      <div className="min-w-0">
        <p id={labelId} className="text-body font-semibold text-ink">
          {title}
        </p>
        {hint ? <p className="mt-0.5 text-body-sm text-ink-2">{hint}</p> : null}
        <p aria-live="polite" className={cn('text-body-sm font-semibold', message ? 'mt-1' : '')}>
          {message}
        </p>
      </div>
      <div className={cn('min-w-0', !stack && 'sm:justify-self-end')}>{children(labelId)}</div>
    </li>
  );
}

/** A group heading and its ledger, so every settings group looks the same. */
export function SettingsGroup({
  id,
  title,
  lead,
  label,
  children,
}: {
  id?: string;
  title: string;
  lead?: string;
  label: string;
  children: ReactNode;
}) {
  const headingId = useId();
  return (
    <section id={id} aria-labelledby={headingId} className="grid scroll-mt-24 gap-3">
      <div className="grid gap-0.5">
        <h2 id={headingId} className="text-h3">
          {title}
        </h2>
        {lead ? <p className="max-w-prose text-body-sm text-ink-2">{lead}</p> : null}
      </div>
      <Ledger aria-label={label}>{children}</Ledger>
    </section>
  );
}
