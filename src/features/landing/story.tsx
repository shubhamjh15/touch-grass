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
import { Approx, Button, Card, Lettering, Panel, StickerPill, Tag } from '@/ui';
import { HERO, PROBLEM, TIMELAPSE, TIMELAPSE_CAPTIONS } from './copy';
import { AllDoomSpot, InvisibleSpot, NoFeedbackSpot } from './illustrations';
import {
  DEMO_ANCHOR,
  DEMO_CONTEXT,
  FIRST_STICKER_ATTR,
  TIMELAPSE_FRAMES,
  timelapseLabel,
  type TimelapseMoment,
} from './model';
import { Reveal, WithUnit } from './parts';

// --- Hero ------------------------------------------------------------------------------------

/**
 * The headline, the pitch and the two ways in. Everything here is static HTML: it paints
 * before any script, font swap or 3D arrives.
 */
export function Hero() {
  const tryIt = (event: MouseEvent<HTMLAnchorElement>) => {
    const first = document.querySelector<HTMLElement>(`[${FIRST_STICKER_ATTR}]`);
    if (!first) return;
    // Without JavaScript this is a plain jump to the demo; with it, focus goes straight to a sticker.
    event.preventDefault();
    first.focus({ preventScroll: true });
    first.scrollIntoView({ block: 'center', behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
  };

  return (
    <div className="pt-3 px-gutter pb-5 lg:px-0 lg:pt-0 lg:pb-8">
      <StickerPill hue="pink" rotate={-2}>
        {HERO.pill}
      </StickerPill>
      {/* The shell moves focus here on arrival, for screen readers. A heading needs no ring. */}
      <h1 className="mt-3.5 focus-visible:shadow-none focus-visible:outline-hidden lg:mt-6">
        <span className="block text-display-hero lg:text-display-xl">
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
        <span className="mt-2.5 block text-h2 lg:mt-4">{HERO.titleTail}</span>
      </h1>
      <p className="mt-2.5 max-w-[34rem] text-body text-pretty text-ink-2 lg:mt-4 lg:text-lead">
        {HERO.sub}
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 lg:mt-6">
        <Button asChild variant="primary" size="lg" iconRight={ArrowRight}>
          <Link href={ROUTES.start}>{HERO.primary}</Link>
        </Button>
        {/* The two quieter ways in stay together: beside the button where there is room, under it on a phone. */}
        <div className="flex items-center gap-x-1.5">
          <Button asChild variant="ghost" size="md">
            <a href={`#${DEMO_ANCHOR}`} onClick={tryIt}>
              {HERO.secondary}
            </a>
          </Button>
          <Button asChild variant="ghost" size="md">
            <Link href={ROUTES.demo}>{HERO.grown}</Link>
          </Button>
        </div>
      </div>
    </div>
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
  invisible: <InvisibleSpot className="h-auto w-full" />,
  'no-feedback': <NoFeedbackSpot className="h-auto w-full" />,
  'all-doom': <AllDoomSpot className="h-auto w-full" />,
};

const PROBLEM_FILL = { invisible: 'blue', 'no-feedback': 'yellow', 'all-doom': 'pink' } as const;

function ProblemLine({ line }: { line: string }) {
  const [before, after] = line.split('{kg}');
  if (after === undefined) return <WithUnit text={line} />;
  return (
    <>
      {before}
      <span className="whitespace-nowrap">
        <Approx />
        {invisibleKg()}
      </span>
      <WithUnit text={after} />
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
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <h3 className="text-display-sm">
                    <Lettering fill={PROBLEM_FILL[card.id]}>{card.word}</Lettering>
                  </h3>
                  <p className="mt-3 text-h4">
                    <ProblemLine line={card.line} />
                  </p>
                </div>
                <div className="-mt-1 w-[84px] shrink-0 md:w-16 lg:w-[84px]">
                  {PROBLEM_ART[card.id]}
                </div>
              </div>
              <p className="mt-2 max-w-prose text-body-sm text-ink-2">
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
          <p className="mt-2 max-w-prose text-body text-pretty">{PROBLEM.answerBody}</p>
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
            <p className="mt-1.5 max-w-prose text-body-sm text-ink-2 lg:mt-3 lg:text-lead">
              {TIMELAPSE.lead}
            </p>
          </header>

          <div className="relative mt-4 min-h-0 flex-1 lg:mt-0 lg:pl-9">
            <StageRuler frame={moment.frame} progress={moment.progress} />
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
                      <p className="mt-1.5 max-w-prose text-body-sm text-ink-2">{caption.body}</p>
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
function StageRuler({ frame, progress }: { frame: number; progress: number }) {
  return (
    <div
      aria-hidden="true"
      className="relative mb-3 flex items-center gap-1 lg:absolute lg:inset-y-0 lg:left-0 lg:mb-0 lg:w-5 lg:flex-col lg:gap-0"
    >
      {/* Desktop: a line from the first tick to the last that inks itself in as the year goes by. */}
      <span className="absolute top-[6.25%] bottom-[6.25%] left-1/2 hidden w-1 -translate-x-1/2 overflow-hidden rounded-pill bg-ink/15 lg:block">
        <span
          className="block size-full origin-top bg-ink transition-transform duration-(--dur-fast) ease-out"
          style={{ transform: `scaleY(${progress})` }}
        />
      </span>
      {TIMELAPSE_FRAMES.map((entry, index) => (
        <span
          key={entry.id}
          className="flex h-3 flex-1 items-center lg:h-auto lg:w-full lg:justify-center"
        >
          <span
            className={cn(
              'relative block h-1.5 w-full rounded-pill border-[1.5px] border-ink transition-colors duration-(--dur-fast) lg:size-3.5 lg:border-2',
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
