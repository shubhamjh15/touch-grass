'use client';

import { ArrowRight } from 'lucide-react';
import type { ComponentProps, ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { Approx } from './Approx';
import { UiLink } from './Link';
import { Popover } from './Popover';
import { Tag } from './Tag';
import type { EstimateSource } from './estimate';

function Leader({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <dt className="shrink-0 type-slug text-ink-3">{label}</dt>
      <span
        aria-hidden="true"
        className="min-w-3 flex-1 -translate-y-0.5 border-b-2 border-dotted border-ink-4"
      />
      <dd className="text-right font-mono text-data text-ink">{value}</dd>
    </div>
  );
}

/** What the mark opens: the formula, the comparison, the likely range and the source of one estimate. */
export function EstimateDetails({
  source,
  className,
  ...rest
}: ComponentProps<'div'> & { source: EstimateSource }) {
  return (
    <div className={cn('text-ink', className)} {...rest}>
      <div className="flex flex-wrap items-center gap-2">
        <Tag hue="yellow">{source.code}</Tag>
        <span className="type-slug text-ink-3">How we got this</span>
      </div>
      {source.kind === 'ai' ? (
        <p className="mt-2.5 text-body-sm font-bold">AI estimate, low confidence</p>
      ) : null}
      <p className="mt-2.5 font-mono text-data font-semibold break-words">{source.formula}</p>
      <p className="mt-2 text-body-sm text-ink-2">{source.comparedWith}</p>
      <dl className="mt-3 grid gap-1.5">
        {source.range ? <Leader label="Likely range" value={source.range} /> : null}
        <Leader
          label="Source"
          value={source.year ? `${source.sourceLabel}, ${source.year}` : source.sourceLabel}
        />
      </dl>
      <UiLink
        href={source.href}
        className="mt-3 inline-flex min-h-11 items-center gap-1 link text-body-sm"
      >
        Open methodology
        <ArrowRight size={16} strokeWidth={2.25} aria-hidden="true" />
      </UiLink>
    </div>
  );
}

export type HonestyMarkProps = Omit<ComponentProps<'button'>, 'children'> & {
  source: EstimateSource;
  size?: 'sm' | 'md';
};

/**
 * The honest "≈": a button in front of an estimate that opens exactly how that number was made.
 * Every view with a CO2e figure has at least one. Game values (level, streak, XP) never show it.
 * Renders nothing for `kind: 'none'`: there the value itself reads "Not estimated".
 */
export function HonestyMark({ source, size = 'md', className, ...rest }: HonestyMarkProps) {
  if (source.kind === 'none') return null;

  const trigger = (
    <button
      type="button"
      aria-label="About this estimate"
      className={cn(
        'hit-3 inline-grid shrink-0 place-items-center rounded-xs border-2 border-ink bg-yellow-tint align-middle text-ink transition-transform duration-(--dur-fast) ease-out active:bg-yellow aria-expanded:bg-yellow data-[state=open]:bg-yellow fine:hover:-translate-y-px',
        size === 'md' ? 'size-[22px] text-[1.2rem]' : 'size-[18px] text-[1rem]',
        className,
      )}
      {...rest}
    >
      <Approx spoken={false} className="mr-0 align-baseline" />
    </button>
  );

  return (
    <Popover
      trigger={trigger}
      tone="paper"
      width={300}
      sheetTitle="About this estimate"
      label="About this estimate"
    >
      <EstimateDetails source={source} />
    </Popover>
  );
}
