'use client';

import { useState, type ReactNode } from 'react';
import { ATMOSPHERIC_CO2, LESSONS, MYTHS } from '@/data/content';
import { DAILY_QUEST_BY_ID } from '@/data/quests';
import { BREAK_DURATIONS_MIN, XP_BREAK_SHORT } from '@/game';
import { cn } from '@/lib/cn';
import { formatDecimal, formatNumber } from '@/lib/format';
import { play } from '@/lib/sfx';
import {
  Button,
  Card,
  Chip,
  MossFace,
  RingProgress,
  Tag,
  TearStub,
  TiltCard,
  isCategoryId,
  type Hue,
} from '@/ui';
import { TOUR } from './copy';
import { Band } from './lower';
import { Reveal, SectionHead } from './parts';

// --- Quests: a real daily quest whose stub tears off (on this page only) -----------------------

const QUEST = DAILY_QUEST_BY_ID.get('d_plant_plate');

function QuestMini() {
  const [claimed, setClaimed] = useState(false);
  if (!QUEST) return null;
  return (
    <TearStub
      title={QUEST.title}
      description={QUEST.copy}
      category={isCategoryId(QUEST.pool) ? QUEST.pool : undefined}
      kind="daily"
      progress={{ value: 1, max: 1 }}
      reward={`+${formatNumber(QUEST.xp)} XP`}
      state={claimed ? 'claimed' : 'claimable'}
      timeLeft={TOUR.questLabel}
      surface="card"
      onClaim={() => {
        play('tear');
        setClaimed(true);
      }}
    />
  );
}

// --- Learn: one real myth card, both faces ------------------------------------------------------

const MYTH = MYTHS.find((myth) => myth.id === 'recycling-best') ?? MYTHS[0];

function MythMini() {
  const [flipped, setFlipped] = useState(false);
  if (!MYTH) return null;
  const source = MYTH.sources[0];
  return (
    <div className="rounded-md border-3 border-ink bg-blue-tint p-3.5">
      <div className="flex items-center justify-between gap-2">
        <Tag hue={flipped ? 'ink' : 'white'}>{flipped ? MYTH.verdictLabel : 'Myth'}</Tag>
        <Button
          size="sm"
          variant="neutral"
          aria-expanded={flipped}
          aria-controls="tour-myth-back"
          onClick={() => {
            play('toggle', { on: !flipped });
            setFlipped((current) => !current);
          }}
        >
          {flipped ? TOUR.mythBack : TOUR.mythFlip}
        </Button>
      </div>
      <p className={cn('mt-3 text-h4', flipped && 'text-ink-3 line-through decoration-2')}>
        {MYTH.myth}
      </p>
      <div id="tour-myth-back" hidden={!flipped} className="mt-2.5 animate-stick">
        <p className="text-body-sm text-ink-2">{MYTH.explanation}</p>
        {source ? (
          <p className="mt-2 type-slug leading-[1.5] text-ink-3">
            Source: {source.publisher}, {source.year}
          </p>
        ) : null}
      </div>
    </div>
  );
}

// --- Impact: one headline figure from a bundled public dataset ---------------------------------

const CO2_SERIES = ATMOSPHERIC_CO2.series;
const CO2_FIRST = CO2_SERIES[0];
const CO2_LAST = CO2_SERIES[CO2_SERIES.length - 1];

/** The series as one thin line. Decoration beside the figure: the numbers are in the text. */
function Sparkline() {
  if (!CO2_FIRST || !CO2_LAST) return null;
  const width = 240;
  const height = 56;
  const pad = 5;
  const values = CO2_SERIES.map((point) => point.value);
  const low = Math.min(...values);
  const high = Math.max(...values);
  const span = Math.max(1, CO2_LAST.year - CO2_FIRST.year);
  const points = CO2_SERIES.map((point) => {
    const x = pad + ((point.year - CO2_FIRST.year) / span) * (width - pad * 2);
    const y =
      height - pad - ((point.value - low) / Math.max(1e-6, high - low)) * (height - pad * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const [lastX, lastY] = (points[points.length - 1] ?? '0,0').split(',');
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      aria-hidden="true"
      focusable="false"
      className="mt-3 block h-14 w-full overflow-visible"
      preserveAspectRatio="none"
    >
      <line
        x1={pad}
        x2={width - pad}
        y1={height - 1}
        y2={height - 1}
        stroke="var(--color-ink-4)"
        strokeWidth={1}
        vectorEffect="non-scaling-stroke"
      />
      <polyline
        points={points.join(' ')}
        fill="none"
        stroke="var(--color-ink)"
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <circle
        cx={lastX}
        cy={lastY}
        r={4}
        fill="var(--color-yellow)"
        stroke="var(--color-ink)"
        strokeWidth={2}
      />
    </svg>
  );
}

function ImpactMini() {
  if (!CO2_FIRST || !CO2_LAST) return null;
  return (
    <figure className="rounded-md border-3 border-ink bg-card p-3.5">
      <figcaption className="type-slug leading-[1.5] text-ink-3">
        CO2 in the air, Mauna Loa, yearly mean
      </figcaption>
      <p className="mt-2 flex items-baseline gap-2">
        <span className="type-figure text-display-md">{formatDecimal(CO2_LAST.value, 0)}</span>
        <span className="font-mono text-data text-ink-2">
          ppm in {CO2_LAST.year} · {formatDecimal(CO2_FIRST.value, 0)} in {CO2_FIRST.year}
        </span>
      </p>
      <Sparkline />
      <p className="mt-2 type-slug leading-[1.5] text-ink-3">NOAA GML · {TOUR.dataNote}</p>
    </figure>
  );
}

// --- Moss: what an exchange looks like, labelled as a sample ------------------------------------

function MossMini() {
  return (
    <div className="grid gap-2.5">
      <p className="ml-auto max-w-[85%] rounded-md rounded-br-xs border-2 border-ink bg-white px-3 py-2 text-body-sm">
        <span className="sr-only">You: </span>
        {TOUR.mossQuestion}
      </p>
      <div className="flex items-end gap-2">
        <MossFace size={36} />
        <div className="max-w-[85%] rounded-md rounded-bl-xs border-2 border-ink bg-green-tint px-3 py-2">
          <p className="text-body-sm">
            <span className="sr-only">Moss: </span>
            {TOUR.mossAnswer}
          </p>
          <Chip as="span" className="mt-2">
            {TOUR.mossChip}
          </Chip>
        </div>
      </div>
      <p className="type-slug text-ink-3">{TOUR.sampleLabel} reply</p>
    </div>
  );
}

// --- Touch grass: the shortest break and what it really pays ------------------------------------

function BreakMini() {
  const minutes = BREAK_DURATIONS_MIN[0];
  return (
    <div className="flex items-center gap-4">
      <RingProgress
        value={0}
        max={minutes}
        size={96}
        tone="green"
        label={TOUR.breakLabel}
        valueText={`${formatNumber(minutes)} minutes to go`}
        keepChildren
      >
        <span className="type-figure text-display-xs">{TOUR.breakTime}</span>
      </RingProgress>
      <div className="min-w-0">
        <Tag hue="yellow">+{formatNumber(XP_BREAK_SHORT)} XP</Tag>
        <p className="mt-2 text-body-sm text-ink-2">
          For {formatNumber(minutes)} minutes away from the screen. The timer checks that you left.
        </p>
      </div>
    </div>
  );
}

// --- The five cards ---------------------------------------------------------------------------

interface TourCard {
  id: keyof typeof TOUR.cards;
  tone: Hue;
  mini: ReactNode;
  /** Desktop: three cards on the first row, two wider ones on the second. */
  span: string;
}

const CARDS: readonly TourCard[] = [
  { id: 'quests', tone: 'yellow', mini: <QuestMini />, span: 'lg:col-span-2' },
  { id: 'learn', tone: 'blue', mini: <MythMini />, span: 'lg:col-span-2' },
  { id: 'impact', tone: 'teal', mini: <ImpactMini />, span: 'lg:col-span-2' },
  { id: 'moss', tone: 'green', mini: <MossMini />, span: 'lg:col-span-3' },
  { id: 'touchGrass', tone: 'pink', mini: <BreakMini />, span: 'lg:col-span-3' },
];

function cardLine(line: string): string {
  return line
    .replace('{lessons}', formatNumber(LESSONS.length))
    .replace('{myths}', formatNumber(MYTHS.length));
}

/** Five things inside the app, each shown with a working miniature rather than a screenshot. */
export function Tour() {
  return (
    <Band aria-labelledby="tour-title">
      <SectionHead id="tour-title" slug={TOUR.slug} title={TOUR.title} />
      <ul className="scroll-row mt-8 snap-x gap-4 [--row-pad:16px] lg:grid lg:snap-none lg:grid-cols-6 lg:gap-5 lg:overflow-visible">
        {CARDS.map((card, index) => {
          const copy = TOUR.cards[card.id];
          return (
            <Reveal
              as="li"
              key={card.id}
              delay={index * 28}
              className={cn(
                'w-[82vw] max-w-[340px] shrink-0 snap-start lg:w-auto lg:max-w-none',
                card.span,
              )}
            >
              <TiltCard maxTilt={3} className="h-full">
                <Card tone={card.tone} className="flex h-full flex-col">
                  <h3 className="text-h2">{copy.title}</h3>
                  <p className="mt-2 text-h4">{cardLine(copy.line)}</p>
                  <p className="mt-1.5 text-body-sm text-ink-2">{copy.body}</p>
                  <div className="mt-auto pt-5">{card.mini}</div>
                </Card>
              </TiltCard>
            </Reveal>
          );
        })}
      </ul>
    </Band>
  );
}
