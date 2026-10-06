'use client';

import { ArrowRight, Check, Minus, Plus } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { ROUTES } from '@/app/routes';
import { ACTIONS, ACTION_BY_ID, CATEGORIES, SOURCES } from '@/data/catalogue';
import { actionAnchor } from '@/data/content';
import { DAILY_QUEST_BY_ID } from '@/data/quests';
import { DAILY_GOAL, estimateKg } from '@/game';
import { cn } from '@/lib/cn';
import { formatCo2Estimate, formatNumber } from '@/lib/format';
import {
  Approx,
  Button,
  Card,
  Chip,
  CloudGlyph,
  Co2e,
  EstimateDetails,
  Ledger,
  Lettering,
  ListRow,
  Panel,
  Receipt,
  RingProgress,
  Sticker,
  StickerPill,
  TapeNote,
  TearStub,
  isCategoryId,
  type EstimateSource,
} from '@/ui';
import { FAQ, FINAL, HONEST, HOW, KIND, PRIVATE } from './copy';
import { MiniTree } from './illustrations';
import { DEMO_ACTIONS, DEMO_CONTEXT, demoEstimate } from './model';
import { Reveal, SectionHead } from './parts';

/** The column every section below the story shares. */
export function Band({
  children,
  className,
  ...rest
}: {
  children: ReactNode;
  className?: string;
  id?: string;
  'aria-labelledby': string;
}) {
  return (
    <section className={cn('py-14 px-gutter lg:px-6 lg:py-20', className)} {...rest}>
      <div className="mx-auto max-w-[1120px]">{children}</div>
    </section>
  );
}

// --- How it works ------------------------------------------------------------------------------

const BIKE = DEMO_ACTIONS.find((action) => action.id === 'biked-5-km') ?? DEMO_ACTIONS[0];
const SAMPLE_QUEST = DAILY_QUEST_BY_ID.get('d_five_k');

function howBody(body: string): string {
  return body
    .replace('{actions}', formatNumber(ACTIONS.length))
    .replace('{categories}', formatNumber(CATEGORIES.length));
}

/** The two picks of a log, drawn still: which action, and how much of it. */
function LogMini() {
  return (
    <div className="grid w-full gap-4">
      <div className="flex items-end justify-between gap-1">
        <Sticker category="move" label="Move" size={44} />
        <Sticker category="eat" label="Eat" size={44} />
        <Sticker category="power" label="Power" size={44} />
        <Sticker category="water" label="Water" size={44} />
        <Sticker category="nature" ghost size={44} />
      </div>
      <p className="flex flex-wrap items-center gap-2">
        <span className="type-slug text-ink-3">{HOW.amountLabel}</span>
        {HOW.amounts.map((amount, index) => (
          <Chip as="span" key={amount} selected={index === 1}>
            {amount}
          </Chip>
        ))}
      </p>
    </div>
  );
}

function SeeMini() {
  const estimate = BIKE ? demoEstimate(BIKE) : null;
  const action = BIKE ? ACTION_BY_ID.get(BIKE.actionId) : undefined;
  if (!BIKE || !estimate || !action) return null;
  return (
    <Receipt
      title="Stuck"
      meta={`Vs. ${estimate.comparedWith}`}
      rows={[
        {
          label: BIKE.label,
          value: (
            <>
              <Approx weight="mono" />
              {estimate.text}
            </>
          ),
        },
        { label: 'Effort', value: `+${formatNumber(action.xp)} XP` },
      ]}
      className="mx-1"
    />
  );
}

function KeepGoingMini() {
  return (
    <div className="grid gap-3">
      {SAMPLE_QUEST ? (
        <TearStub
          title={SAMPLE_QUEST.title}
          description={SAMPLE_QUEST.copy}
          category={isCategoryId(SAMPLE_QUEST.pool) ? SAMPLE_QUEST.pool : undefined}
          kind="daily"
          progress={{ value: 2, max: 5 }}
          reward={`+${formatNumber(SAMPLE_QUEST.xp)} XP`}
          state="active"
          timeLeft={HOW.sampleLabel}
          surface="mat"
        />
      ) : null}
      <div className="flex items-center gap-4">
        <RingProgress value={DAILY_GOAL - 1} max={DAILY_GOAL} size={48} label={HOW.ringLabel}>
          {DAILY_GOAL - 1}/{DAILY_GOAL}
        </RingProgress>
        <CloudGlyph size={64} role="img" aria-label={HOW.rainLabel} aria-hidden={undefined} />
        <p className="min-w-0 flex-1 text-caption text-ink-2">
          A ring two thirds drawn, and one rain day in the bank.
        </p>
      </div>
    </div>
  );
}

const HOW_MINI: Record<(typeof HOW.steps)[number]['id'], ReactNode> = {
  log: <LogMini />,
  see: <SeeMini />,
  'keep-going': <KeepGoingMini />,
};

const HOW_FILL = { log: 'green', see: 'blue', 'keep-going': 'yellow' } as const;

export function HowItWorks() {
  return (
    <Band id="how-it-works" aria-labelledby="how-title" className="scroll-mt-20">
      <SectionHead id="how-title" slug={HOW.slug} title={HOW.title} />
      <ol className="mt-8 grid gap-5 lg:grid-cols-3">
        {HOW.steps.map((step, index) => (
          <Reveal as="li" key={step.id} delay={index * 28}>
            <Panel variant="graph" className="flex h-full flex-col p-5 shadow-3 md:border-4">
              <div className="flex items-center gap-3">
                <StickerPill hue="yellow" rotate={index % 2 === 0 ? -2 : 2} aria-hidden="true">
                  {index + 1}
                </StickerPill>
                <h3 className="text-display-sm">
                  <span className="sr-only">Step {index + 1}: </span>
                  <Lettering fill={HOW_FILL[step.id]} tilt="none">
                    {step.word}
                  </Lettering>
                </h3>
              </div>
              <p className="mt-4 text-h4">{step.line}</p>
              <p className="mt-1.5 text-body-sm text-ink-2">{howBody(step.body)}</p>
              {/* One tray per card, all the same height: the samples line up across the row. */}
              <div className="mt-5 grid flex-1 place-items-center rounded-md border-2 border-ink bg-mat-deep p-4 inset-shadow-deboss">
                {HOW_MINI[step.id]}
              </div>
            </Panel>
          </Reveal>
        ))}
      </ol>
    </Band>
  );
}

// --- Honest numbers ----------------------------------------------------------------------------

const FACTOR_ACTION_ID = 'walk-cycle-instead-of-car';

/** The factor row shown on the page, with exactly what its honesty mark would open. */
function factorExample(): {
  title: string;
  meta: string;
  value: string;
  source: EstimateSource;
} | null {
  const action = ACTION_BY_ID.get(FACTOR_ACTION_ID);
  const estimate = action ? estimateKg(action, 1, DEMO_CONTEXT) : null;
  if (!action || !estimate) return null;
  const source = action.sources.map((key) => SOURCES[key]).find(Boolean);
  const value = formatCo2Estimate(estimate.kg);
  return {
    title: HONEST.rowTitle,
    meta: HONEST.rowMeta,
    value,
    source: {
      code: 'Factor',
      kind: 'factor',
      formula: `1 ${action.unit} × ${value} per ${action.unit} = ${value}`,
      comparedWith: `Compared with ${action.counterfactual}. World-average car; the app uses your region's.`,
      range: `${formatCo2Estimate(estimate.low)} to ${formatCo2Estimate(estimate.high)}`,
      sourceLabel: source ? (source.publisher ?? source.title) : 'Our factor table',
      year: source?.year,
      href: `${ROUTES.methodology}#${actionAnchor(action.id)}`,
    },
  };
}

export function HonestNumbers() {
  const example = factorExample();
  return (
    <Band aria-labelledby="honest-title">
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:items-start lg:gap-14">
        <div>
          <SectionHead
            id="honest-title"
            slug={HONEST.slug}
            title={HONEST.title}
            lead={HONEST.lead}
          />
          <ul className="mt-6 grid gap-2.5">
            {HONEST.rules.map((rule) => (
              <li key={rule} className="flex items-start gap-3 text-body">
                <span
                  aria-hidden="true"
                  className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-xs border-2 border-ink bg-yellow"
                >
                  <Approx spoken={false} className="mr-0" />
                </span>
                {rule}
              </li>
            ))}
          </ul>
          <Button asChild variant="neutral" size="md" iconRight={ArrowRight} className="mt-7">
            <Link href={ROUTES.methodology}>{HONEST.link}</Link>
          </Button>
        </div>

        {example ? (
          <Reveal className="relative">
            <Ledger aria-label={HONEST.ledgerLabel}>
              <ListRow
                leading={<Sticker category="move" size={32} rotate={-4} />}
                title={example.title}
                meta={example.meta}
                value={
                  <>
                    <Approx weight="mono" />
                    {example.value} <Co2e explain />
                  </>
                }
              />
            </Ledger>
            <div className="relative mt-5 ml-auto w-full max-w-[340px] lg:mr-6">
              <span aria-hidden="true" className="absolute -top-5 right-12 h-5 w-0.5 bg-ink" />
              <p className="mb-2 type-slug text-ink-3">{HONEST.openLabel}</p>
              <Panel variant="paper" className="rotate-1">
                <EstimateDetails source={example.source} />
              </Panel>
            </div>
          </Reveal>
        ) : null}
      </div>
    </Band>
  );
}

// --- Kind by design, private by default --------------------------------------------------------

export function KindAndPrivate() {
  return (
    <div className="py-14 px-gutter lg:px-6 lg:py-20">
      <div className="mx-auto grid max-w-[1120px] grid-cols-1 gap-14 lg:grid-cols-2 lg:gap-12">
        <section aria-labelledby="kind-title">
          <SectionHead id="kind-title" slug={KIND.slug} title={KIND.title} />
          <TapeNote tape="blue" rotate={-1} className="mt-7 max-w-[26rem] text-h4">
            {KIND.note}
          </TapeNote>
          <p className="mt-5 max-w-[30rem] text-body text-ink-2">{KIND.body}</p>
          <ul className="mt-7 grid max-w-[30rem] grid-cols-3 gap-3 rounded-lg border-3 border-ink bg-card p-4">
            {KIND.states.map((state, index) => (
              <Reveal as="li" key={state.id} delay={index * 28}>
                <div className="flex flex-col items-center text-center">
                  <MiniTree state={state.id} className="h-auto w-full max-w-24" />
                  <p className="mt-2 text-label">{state.label}</p>
                  <p className="mt-1 text-caption text-ink-2">{state.body}</p>
                </div>
              </Reveal>
            ))}
          </ul>
        </section>

        <section aria-labelledby="private-title">
          <SectionHead id="private-title" slug={PRIVATE.slug} title={PRIVATE.title} />
          <Reveal className="mt-7">
            <Card>
              <ul className="grid gap-3">
                {[...PRIVATE.rows, PRIVATE.extra].map((row) => (
                  <li key={row} className="flex items-center gap-3 text-h4">
                    <span
                      aria-hidden="true"
                      className="grid size-7 shrink-0 place-items-center rounded-full border-2 border-ink bg-green"
                    >
                      <Check size={16} strokeWidth={3} />
                    </span>
                    {row}
                  </li>
                ))}
              </ul>
              <Card.Footer>
                <p className="text-body-sm text-ink-2">{PRIVATE.exception}</p>
                <Link
                  href={ROUTES.privacy}
                  className="mt-2 inline-flex min-h-11 items-center gap-1 link text-body-sm"
                >
                  {PRIVATE.link}
                  <ArrowRight size={16} strokeWidth={2.25} aria-hidden="true" />
                </Link>
              </Card.Footer>
            </Card>
          </Reveal>
        </section>
      </div>
    </div>
  );
}

// --- FAQ ---------------------------------------------------------------------------------------

const FAQ_LINK = { privacy: ROUTES.privacy, methodology: ROUTES.methodology } as const;

/**
 * Six questions as native disclosures: they open with a click, Enter or Space, the browser's
 * find-in-page reaches inside them, and they work before (and without) JavaScript.
 */
export function Faq() {
  return (
    <Band aria-labelledby="faq-title">
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,4fr)_minmax(0,7fr)] lg:gap-14">
        <SectionHead id="faq-title" slug={FAQ.slug} title={FAQ.title} />
        <Card padded={false}>
          <div className="divide-y-[1.5px] divide-ink overflow-hidden rounded-[9px] md:rounded-[12px]">
            {FAQ.items.map((item) => (
              <details key={item.id} className="group/faq bg-card open:bg-yellow-tint">
                <summary className="flex min-h-14 cursor-pointer list-none items-center gap-3 px-4 py-3 focus-inset md:px-5 fine:hover:bg-yellow-tint [&::-webkit-details-marker]:hidden">
                  <h3 className="min-w-0 flex-1 text-h4">{item.question}</h3>
                  <span
                    aria-hidden="true"
                    className="grid size-8 shrink-0 place-items-center rounded-full border-2 border-ink bg-white group-open/faq:bg-yellow"
                  >
                    <Plus size={16} strokeWidth={3} className="group-open/faq:hidden" />
                    <Minus size={16} strokeWidth={3} className="hidden group-open/faq:block" />
                  </span>
                </summary>
                <div className="px-4 pb-4 md:px-5">
                  <p className="max-w-[62ch] text-body text-ink-2">{item.answer}</p>
                  {'link' in item ? (
                    <Link
                      href={FAQ_LINK[item.link.to]}
                      className="mt-1 inline-flex min-h-11 items-center gap-1 link text-body-sm"
                    >
                      {item.link.label}
                      <ArrowRight size={16} strokeWidth={2.25} aria-hidden="true" />
                    </Link>
                  ) : null}
                </div>
              </details>
            ))}
          </div>
        </Card>
      </div>
    </Band>
  );
}

// --- Final call to action and footer -----------------------------------------------------------

/**
 * The closing stage: the tree the visitor just grew (or a seedling, if they did not try),
 * and one button. `stage` and `mobileStage` are the two layout slots of the same grove.
 */
export function FinalCta({
  grown,
  stage,
  mobileStage,
}: {
  grown: boolean;
  stage: ReactNode;
  mobileStage: ReactNode;
}) {
  const lines = grown ? FINAL.grownLines : FINAL.freshLines;
  return (
    <section
      aria-labelledby="final-title"
      className="lg:grid lg:grid-cols-[min(62.5%,960px)_minmax(0,1fr)]"
    >
      {stage}
      {mobileStage}
      <div className="flex flex-col justify-center py-12 px-gutter max-lg:edge-pinked-t lg:edge-pinked-l lg:py-16 lg:pr-10 lg:pl-11">
        <h2 id="final-title" className="text-display-lg xl:text-display-xl">
          {lines.map((line) => (
            <Lettering key={line} fill="yellow" className="block w-fit">
              {line}
            </Lettering>
          ))}
        </h2>
        <p className="mt-5 max-w-[30rem] text-lead text-pretty text-ink-2">{FINAL.body}</p>
        <div className="mt-7 flex flex-wrap items-center gap-x-5 gap-y-3">
          <Button asChild variant="ink" size="lg" iconRight={ArrowRight}>
            <Link href={ROUTES.start}>{FINAL.action}</Link>
          </Button>
          <p className="text-body-sm text-ink-2">{FINAL.aside}</p>
        </div>
      </div>
    </section>
  );
}
