'use client';

import type { ComponentProps, CSSProperties, ReactNode } from 'react';
import { cn } from '@/lib/cn';

/** A numbered, anchor-linked chapter of the kitchen sink. */
export function Section({
  id,
  index,
  title,
  note,
  children,
}: {
  id: string;
  index: number;
  title: string;
  note?: string;
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-title`}
      className="scroll-mt-24 border-t-3 border-ink pt-6"
    >
      <div className="mb-5 flex flex-wrap items-baseline gap-x-4 gap-y-1.5">
        <span className="type-slug text-ink-3">Nº {String(index).padStart(2, '0')}</span>
        <h2 id={`${id}-title`} className="text-h2">
          <a href={`#${id}`} className="rounded-xs">
            {title}
          </a>
        </h2>
        {note ? <p className="type-slug leading-[1.5] text-ink-3">{note}</p> : null}
      </div>
      <div className="grid gap-8">{children}</div>
    </section>
  );
}

/** One specimen group with a mono caption above it. */
export function Demo({
  label,
  note,
  className,
  children,
  ...rest
}: ComponentProps<'div'> & { label: string; note?: string }) {
  return (
    <div className="min-w-0" {...rest}>
      <div className="mb-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h3 className="text-h4">{label}</h3>
        {note ? <p className="text-caption text-ink-3">{note}</p> : null}
      </div>
      <div className={cn('flex flex-wrap items-start gap-x-5 gap-y-6', className)}>{children}</div>
    </div>
  );
}

/** A specimen with its state named underneath, like the look-dev sheet. */
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
    <figure className={cn('flex flex-col items-center gap-3', className)}>
      {children}
      <figcaption className="text-center type-tick leading-[1.5] text-ink-3">{name}</figcaption>
    </figure>
  );
}

export type SkyTime = 'dawn' | 'day' | 'dusk' | 'night';

const SKY: Record<SkyTime, CSSProperties> = {
  dawn: {
    '--sky-0': 'var(--sky-dawn-0)',
    '--sky-1': 'var(--sky-dawn-1)',
    '--sky-2': 'var(--sky-dawn-2)',
    '--sky-3': 'var(--sky-dawn-3)',
    '--orb': 'var(--orb-dawn)',
    '--cloud': 'var(--cloud-dawn)',
  } as CSSProperties,
  day: {
    '--sky-0': 'var(--sky-day-0)',
    '--sky-1': 'var(--sky-day-1)',
    '--sky-2': 'var(--sky-day-2)',
    '--sky-3': 'var(--sky-day-3)',
    '--orb': 'var(--orb-day)',
    '--cloud': 'var(--cloud-day)',
  } as CSSProperties,
  dusk: {
    '--sky-0': 'var(--sky-dusk-0)',
    '--sky-1': 'var(--sky-dusk-1)',
    '--sky-2': 'var(--sky-dusk-2)',
    '--sky-3': 'var(--sky-dusk-3)',
    '--orb': 'var(--orb-dusk)',
    '--cloud': 'var(--cloud-dusk)',
  } as CSSProperties,
  night: {
    '--sky-0': 'var(--sky-night-0)',
    '--sky-1': 'var(--sky-night-1)',
    '--sky-2': 'var(--sky-night-2)',
    '--sky-3': 'var(--sky-night-3)',
    '--orb': 'var(--orb-night)',
    '--cloud': 'var(--cloud-night)',
    '--stage-mark': 'var(--cloud-night)',
  } as CSSProperties,
};

const BANDS = ['var(--sky-1)', 'var(--sky-2)', 'var(--sky-3)'] as const;

/**
 * A stand-in for the printed sky (the real one is drawn by the world): four flat bands dithered into
 * each other with halftone rows. Only here so components can be judged on their real background.
 */
export function SkyPlate({
  time = 'day',
  className,
  children,
}: {
  time?: SkyTime;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <div
      className={cn(
        'relative isolate overflow-hidden rounded-lg border-4 border-ink shadow-3',
        className,
      )}
      style={{ ...SKY[time], background: 'var(--sky-0)' }}
    >
      <div aria-hidden="true" className="absolute inset-0 -z-1 flex flex-col">
        <div className="flex-[1.1]" />
        {BANDS.map((band) => (
          <div
            key={band}
            className="halftone-fade-t flex-1"
            style={{ background: band, color: band }}
          />
        ))}
      </div>
      <div aria-hidden="true" className="pointer-events-none absolute inset-3 crop-marks" />
      {children}
    </div>
  );
}
