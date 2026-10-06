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
    <div className="flex items-baseline justify-between gap-3 text-body-sm">
      <dt className="shrink-0 text-ink-3">{label}</dt>
      <dd className="text-right font-medium text-ink tabular-nums">{value}</dd>
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
      <p className="flex flex-wrap items-center gap-2 text-body font-bold">
        How we got this
        <Tag hue="yellow">{source.code}</Tag>
      </p>
      {source.kind === 'ai' ? (
        <p className="mt-2.5 text-body-sm font-semibold">AI estimate, low confidence</p>
      ) : null}
      <p className="mt-2.5 text-body-sm font-semibold break-words tabular-nums">{source.formula}</p>
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
        <ArrowRight size={16} strokeWidth={2} aria-hidden="true" />
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
        'hit-3 inline-grid shrink-0 place-items-center rounded-full border-2 border-ink bg-yellow-tint align-middle text-ink transition-colors duration-(--dur-fast) ease-out active:bg-yellow aria-expanded:bg-yellow data-[state=open]:bg-yellow fine:hover:bg-yellow',
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
