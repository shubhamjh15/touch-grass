'use client';

import { ArrowRight } from 'lucide-react';
import Link from 'next/link';
import type { MouseEvent, ReactNode, RefObject } from 'react';
import { ROUTES } from '@/app/routes';
import { ACTION_BY_ID } from '@/data/catalogue';
import { estimateKg } from '@/game';
import { cn } from '@/lib/cn';
import { formatDecimal, formatNumber } from '@/lib/format';
import { prefersReducedMotion } from '@/lib/hooks';
import {
  Approx,
  Button,
  Card,
  Co2e,
  HonestyMark,
  Lettering,
  Meter,
  Panel,
  Receipt,
  Sticker,
  StickerPill,
  Tag,
  TapeNote,
} from '@/ui';
import { DEMO, HERO, PROBLEM, TIMELAPSE, TIMELAPSE_CAPTIONS } from './copy';
import { AllDoomSpot, InvisibleSpot, NoFeedbackSpot } from './illustrations';
import {
  DEMO_ACTIONS,
  DEMO_CONTEXT,
  DEMO_TAPS_TO_SAPLING,
  TIMELAPSE_FRAMES,
  estimateFor,
  timelapseLabel,
  type TimelapseMoment,
} from './model';
import { Reveal } from './parts';
import type { DemoState } from './useDemo';

/** Where "Try it first" lands: the first demo sticker. */
export const FIRST_STICKER_ID = 'demo-sticker-first';
const DEMO_SECTION_ID = 'try-it';

// --- Hero ------------------------------------------------------------------------------------

/**
 * The headline, the pitch and the two ways in. Everything here is static HTML: it paints
 * before any script, font swap or 3D arrives.
 */
export function Hero() {
  const tryIt = (event: MouseEvent<HTMLAnchorElement>) => {
    const first = document.getElementById(FIRST_STICKER_ID);
    if (!first) return;
    // Without JavaScript this is a plain jump to the demo; with it, focus goes straight to a sticker.
    event.preventDefault();
    first.focus({ preventScroll: true });
    first.scrollIntoView({ block: 'center', behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
  };

  return (
    <div className="pt-5 px-gutter pb-5 lg:px-0 lg:pt-0 lg:pb-8">
      <StickerPill hue="pink" rotate={-2}>
        {HERO.pill}
      </StickerPill>
      <h1 className="mt-4 lg:mt-6">
        <span className="block text-display-hero lg:text-display-xl xl:text-display-hero">
          <Lettering fill="green" sweep hoverTilt className="block w-fit">
            {HERO.titleLead}
          </Lettering>{' '}
          <Lettering fill="green" sweep hoverTilt>
            {HERO.titleLiving}
          </Lettering>{' '}
          <br className="hidden lg:block" />
          <Lettering fill="green" sweep hoverTilt>
            {HERO.titleTree}
          </Lettering>
        </span>{' '}
        <span className="mt-3 block text-h2 lg:mt-5 lg:text-h1">{HERO.titleTail}</span>
      </h1>
      <p className="mt-3 max-w-[34rem] text-body text-pretty text-ink-2 lg:mt-4 lg:text-lead">
        {HERO.sub}
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 lg:mt-6">
        <Button asChild variant="primary" size="lg" iconRight={ArrowRight}>
          <Link href={ROUTES.start}>{HERO.primary}</Link>
        </Button>
        <Button asChild variant="ghost" size="lg">
          <a href={`#${DEMO_SECTION_ID}`} onClick={tryIt}>
            {HERO.secondary}
          </a>
        </Button>
      </div>
    </div>
  );
}

// --- The demo strip ----------------------------------------------------------------------------

function statusLine(demo: DemoState): string {
  const { stage, tapsToSapling } = demo.status;
  if (tapsToSapling === 0) return `Demo tree: ${stage}. Yours would take about nine days.`;
  const more =
    tapsToSapling === 1 ? 'One more sticker' : `${formatNumber(tapsToSapling)} more stickers`;
  return `Demo tree: ${stage}. ${more} to Sapling.`;
}

/**
 * "Stick one on": three real catalogue actions as stickers. Each tap carries the sticker to
 * the tree, grows it and prints the estimate the real log sheet would show. Nothing is saved.
 */
export function DemoPanel({ demo }: { demo: DemoState }) {
  const flying = new Set(demo.flights.map((flight) => flight.action.id));
  const lastEstimate = demo.last ? estimateFor(demo.last) : null;

  return (
    <section id={DEMO_SECTION_ID} aria-labelledby="try-it-title" className="scroll-mt-28">
      <Panel variant="graph" className="bg-card bg-none p-4 shadow-3 md:border-4">
        <div className="flex items-center justify-between gap-3">
          <h2 id="try-it-title" className="text-h3">
            {DEMO.title}
          </h2>
          <Tag hue="yellow">{DEMO.tag}</Tag>
        </div>

        <ul className="mt-3 grid grid-cols-3 justify-items-center gap-2">
          {DEMO_ACTIONS.map((action, index) => (
            <li key={action.id}>
              <Sticker
                id={index === 0 ? FIRST_STICKER_ID : undefined}
                category={action.category}
                label={action.label}
                size={66}
                ghost={flying.has(action.id)}
                className="w-24 scroll-mt-28"
                onClick={() => {
                  const origin = document.querySelector<HTMLElement>(
                    `[data-demo-sticker="${action.id}"]`,
                  );
                  if (origin) demo.stick(action, origin);
                }}
                data-demo-sticker={action.id}
              />
            </li>
          ))}
        </ul>

        <div className="mt-3 flex items-center gap-3 border-t-[1.5px] border-ink pt-3">
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
      </Panel>

      <div className="mt-5 grid gap-4">
        {demo.tally.length === 0 ? (
          <p className="grid min-h-24 place-items-center rounded-sm dieline px-4 text-center font-mono text-data text-ink-3">
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
    </section>
  );
}

// --- The problem, in three stickers ------------------------------------------------------------

const PROBLEM_KM = 4;

/** "Nobody can feel 0.8 kg": the figure is a real 4 km of not driving, from the factor table. */
function invisibleKg(): string {
  const action = ACTION_BY_ID.get('walk-cycle-instead-of-car');
  const estimate = action ? estimateKg(action, PROBLEM_KM, DEMO_CONTEXT) : null;
  return estimate ? `${formatDecimal(estimate.kg, 1)} kg` : 'a kilogram';
}

const PROBLEM_ART: Record<(typeof PROBLEM.cards)[number]['id'], ReactNode> = {
  invisible: <InvisibleSpot />,
  'no-feedback': <NoFeedbackSpot />,
  'all-doom': <AllDoomSpot />,
};

const PROBLEM_FILL = { invisible: 'blue', 'no-feedback': 'yellow', 'all-doom': 'pink' } as const;

function ProblemLine({ line }: { line: string }) {
  const [before, after] = line.split('{kg}');
  if (after === undefined) return <>{line}</>;
  return (
    <>
      {before}
      <span className="whitespace-nowrap">
        <Approx />
        {invisibleKg()}
      </span>
      {after}
    </>
  );
}

export function Problem() {
  return (
    <section aria-labelledby="problem-title" className="py-12 px-gutter lg:px-0 lg:py-20">
      <p className="type-slug text-ink-3">{PROBLEM.slug}</p>
      <h2 id="problem-title" className="mt-3 text-h1 text-balance">
        {PROBLEM.title}
      </h2>
      <ul className="mt-6 grid gap-4 md:grid-cols-3 lg:grid-cols-1">
        {PROBLEM.cards.map((card, index) => (
          <Reveal as="li" key={card.id} delay={index * 28}>
            <Card className="h-full">
              <div className="flex items-start justify-between gap-3">
                <h3 className="text-display-sm">
                  <Lettering fill={PROBLEM_FILL[card.id]}>{card.word}</Lettering>
                </h3>
                <div className="-mt-1 w-[88px] shrink-0 md:w-[72px] lg:w-[88px]">
                  <div className="origin-top-right scale-[0.73] md:scale-[0.6] lg:scale-[0.73]">
                    {PROBLEM_ART[card.id]}
                  </div>
                </div>
              </div>
              <p className="mt-3 text-h4">
                <ProblemLine line={card.line} />
              </p>
              <p className="mt-1.5 text-body-sm text-ink-2">
                {card.body.replace('{km}', formatNumber(PROBLEM_KM))}
              </p>
            </Card>
          </Reveal>
        ))}
      </ul>

      <Reveal className="mt-8">
        <Card tone="green" featured plate="yellow">
          <p className="type-slug text-ink-2">{PROBLEM.answerSlug}</p>
          <h3 className="mt-2 text-h2 text-balance">{PROBLEM.answerTitle}</h3>
          <p className="mt-2 text-body text-pretty">{PROBLEM.answerBody}</p>
        </Card>
      </Reveal>
    </section>
  );
}

// --- The scroll time-lapse ---------------------------------------------------------------------

/**
 * Seed to grand tree, driven by the page's own scroll. On phones the scene is pinned: the
 * stage on top, the current caption under it. Beside the desktop stage the captions scroll
 * past normally. Every caption is real text in the page either way.
 */
export function TimeLapse({
  sectionRef,
  listRef,
  moment,
  stage,
}: {
  sectionRef: RefObject<HTMLElement | null>;
  listRef: RefObject<HTMLOListElement | null>;
  moment: TimelapseMoment;
  /** The phone's pinned stage (the desktop stage lives outside this section). */
  stage: ReactNode;
}) {
  return (
    <section
      ref={sectionRef}
      aria-labelledby="time-lapse-title"
      className="relative h-[250vh] lg:h-auto"
    >
      <div className="sticky top-0 flex h-dvh flex-col lg:static lg:block lg:h-auto">
        {stage}
        <Panel
          variant="mat"
          edge="pinked-t"
          className="flex min-h-0 flex-1 flex-col pt-6 px-gutter pb-4 lg:block lg:px-0 lg:pt-0 lg:pb-0 lg:before:hidden"
        >
          <header>
            <p className="type-slug text-ink-3">{TIMELAPSE.slug}</p>
            <h2 id="time-lapse-title" className="mt-2 text-h2 text-balance lg:mt-3 lg:text-h1">
              {TIMELAPSE.title}
            </h2>
            <p className="mt-1.5 text-body-sm text-ink-2 lg:mt-3 lg:text-lead">{TIMELAPSE.lead}</p>
          </header>

          <div className="relative mt-4 min-h-0 flex-1 lg:mt-0 lg:pl-9">
            <StageRuler frame={moment.frame} />
            <ol ref={listRef} className="grid lg:block">
              {TIMELAPSE_FRAMES.map((frame, index) => {
                const caption = TIMELAPSE_CAPTIONS[frame.id];
                const active = index === moment.frame;
                return (
                  <li
                    key={frame.id}
                    data-active={active}
                    aria-current={active ? 'step' : undefined}
                    className={cn(
                      'col-start-1 row-start-1 transition-[opacity,translate] duration-(--dur-base) ease-out lg:flex lg:min-h-[37.5vh] lg:items-center',
                      'opacity-0 data-[active=true]:opacity-100 lg:opacity-100',
                      'translate-y-2 data-[active=true]:translate-y-0 lg:translate-y-0 calm:translate-y-0',
                    )}
                  >
                    <Card
                      tone={active ? 'yellow' : 'card'}
                      className="w-full transition-colors duration-(--dur-fast)"
                    >
                      <Tag hue={active ? 'ink' : 'white'}>
                        {timelapseLabel(frame.day, frame.stage)}
                      </Tag>
                      <h3 className="mt-2.5 text-h3">{caption.title}</h3>
                      <p className="mt-1.5 text-body-sm text-ink-2">{caption.body}</p>
                    </Card>
                  </li>
                );
              })}
            </ol>
          </div>

          <p className="mt-3 text-caption text-ink-3 lg:mt-2 lg:pb-16 lg:pl-9">
            {TIMELAPSE.footnote}
          </p>
        </Panel>
      </div>
    </section>
  );
}

/**
 * The ruler: one tick per frame, the current one marked. Along the top of the caption on
 * phones, down the desk's edge on desktop. Decorative; `aria-current` on the caption says the same.
 */
function StageRuler({ frame }: { frame: number }) {
  return (
    <div
      aria-hidden="true"
      className="mb-3 flex items-center gap-1 lg:absolute lg:inset-y-0 lg:left-0 lg:mb-0 lg:w-5 lg:flex-col lg:gap-0"
    >
      {TIMELAPSE_FRAMES.map((entry, index) => (
        <span
          key={entry.id}
          className="flex h-3 flex-1 items-center lg:h-auto lg:w-full lg:justify-center"
        >
          <span
            className={cn(
              'block h-1.5 w-full rounded-pill border-[1.5px] border-ink transition-colors duration-(--dur-fast) lg:size-3.5 lg:border-2',
              index < frame && 'bg-green',
              index === frame && 'bg-yellow',
              index > frame && 'bg-white',
            )}
          />
        </span>
      ))}
    </div>
  );
}
