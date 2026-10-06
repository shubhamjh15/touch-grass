'use client';

import { Hand } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { ROUTES } from '@/app/routes';
import { cn } from '@/lib/cn';
import { formatNumber } from '@/lib/format';
import { Approx, Chip, Co2e, HonestyMark, Meter, Receipt, Sticker, Tag, TapeNote } from '@/ui';
import { useWorldStore } from '@/world';
import { DEMO } from './copy';
import {
  DEMO_ACTIONS,
  DEMO_ANCHOR,
  DEMO_TAPS_TO_SAPLING,
  FIRST_STICKER_ATTR,
  estimateFor,
} from './model';
import type { DemoState } from './useDemo';

const DEMO_TITLE_ID = 'try-it-title';

/**
 * "Stick one on": a small tray of three real catalogue actions that sits at the foot of the
 * tree, so the thing to tap and the thing that grows are in one glance. Each tap carries the
 * sticker to the tree and grows it. Nothing is saved.
 */
export function DemoDock({
  demo,
  extra,
  className,
}: {
  demo: DemoState;
  /** A control that rides along on wide stages (the species picker). */
  extra?: ReactNode;
  className?: string;
}) {
  const flying = new Set(demo.flights.map((flight) => flight.action.id));

  return (
    <section
      aria-labelledby={DEMO_TITLE_ID}
      className={cn(
        'relative rounded-lg border-4 border-ink bg-white px-2 pt-5 pb-2 shadow-3 sm:px-3',
        className,
      )}
      // A press on the tray is a press on a sticker, never the start of turning the island.
      onPointerDown={(event) => event.stopPropagation()}
    >
      <h2 id={DEMO_TITLE_ID} className="absolute -top-3.5 left-4 -rotate-2">
        <Tag hue="yellow">{DEMO.title}</Tag>
      </h2>
      <div className="flex items-center gap-3">
        <ul className="grid flex-1 grid-cols-3 justify-items-center gap-1">
          {DEMO_ACTIONS.map((action, index) => (
            <li key={action.id}>
              <Sticker
                category={action.category}
                label={action.label}
                size={66}
                ghost={flying.has(action.id)}
                className="w-24 origin-bottom transition-transform duration-(--dur-fast) ease-out fine:motion-safe:hover:scale-110"
                onClick={() => {
                  const origin = document.querySelector<HTMLElement>(
                    `[data-demo-sticker="${action.id}"]`,
                  );
                  if (origin) demo.stick(action, origin);
                }}
                data-demo-sticker={action.id}
                {...(index === 0 ? { [FIRST_STICKER_ATTR]: '' } : null)}
              />
            </li>
          ))}
        </ul>
        {extra ? (
          <div className="grid shrink-0 gap-1.5 border-l-[1.5px] border-ink py-1 pl-3">
            <p className="type-slug text-ink-3">{DEMO.speciesShort}</p>
            {extra}
          </div>
        ) : null}
      </div>
    </section>
  );
}

function statusLine(demo: DemoState): string {
  const { stage, tapsToSapling } = demo.status;
  if (tapsToSapling === 0) return `Demo tree: ${stage}. Yours would take about nine days.`;
  const more =
    tapsToSapling === 1 ? 'One more sticker' : `${formatNumber(tapsToSapling)} more stickers`;
  return `Demo tree: ${stage}. ${more} to Sapling.`;
}

/**
 * What the demo answers with: where the demo tree stands, the receipt the real log sheet
 * would print for each sticker, and, after the third one, the offer to plant for real.
 */
export function DemoReadout({ demo, className }: { demo: DemoState; className?: string }) {
  const lastEstimate = demo.last ? estimateFor(demo.last) : null;

  return (
    <div
      id={DEMO_ANCHOR}
      role="group"
      aria-label={DEMO.readoutLabel}
      className={cn('grid scroll-mt-28 gap-4', className)}
    >
      <div className="flex items-center gap-3">
        <p role="status" className="min-w-0 flex-1 text-body-sm text-ink-2">
          {demo.taps === 0 ? DEMO.hint : statusLine(demo)}
        </p>
        <Meter
          pips
          size="sm"
          tone="green"
          value={Math.min(demo.taps, DEMO_TAPS_TO_SAPLING)}
          max={DEMO_TAPS_TO_SAPLING}
          label="Stickers on the way to Sapling"
          className="w-20 shrink-0"
        />
      </div>

      {demo.tally.length === 0 ? (
        <p className="grid min-h-20 place-items-center rounded-sm dieline px-4 text-center font-mono text-data text-ink-3">
          {DEMO.receiptEmpty}
        </p>
      ) : (
        <div>
          <Receipt
            title={DEMO.receiptTitle}
            meta={DEMO.receiptMeta}
            rows={demo.tally.map(({ action, count }) => ({
              label: count > 1 ? `${action.label}, ${formatNumber(count)} times` : action.label,
              value: (
                <>
                  <Approx weight="mono" />
                  {estimateFor(action)?.text}
                </>
              ),
            }))}
          />
          {lastEstimate && demo.last ? (
            <p className="mt-4 flex items-start gap-2.5 text-body-sm text-ink-2">
              <HonestyMark source={lastEstimate.source} className="mt-px" />
              <span>
                {demo.last.label}: <Approx />
                {lastEstimate.text} <Co2e explain /> avoided vs. {lastEstimate.comparedWith}.
              </span>
            </p>
          ) : null}
        </div>
      )}

      {demo.taps >= 3 ? (
        <TapeNote rotate={-1} className="animate-stick">
          {DEMO.note}{' '}
          <Link href={ROUTES.start} className="link whitespace-nowrap">
            {DEMO.noteAction}
          </Link>
        </TapeNote>
      ) : null}
    </div>
  );
}

/**
 * Tells a first-time visitor the island can be turned. Shown only while the live world is on
 * screen (the illustrated tree does not turn) and only until they have tried it.
 */
export function DragHint({ used }: { used: boolean }) {
  const live = useWorldStore((state) => state.status === 'ready');
  if (!live || used) return null;
  return (
    <Chip as="span" icon={Hand} className="animate-stick">
      {DEMO.dragHint}
    </Chip>
  );
}
