'use client';

import { useCallback, useMemo, useState } from 'react';
import { useBreakpoint, useReducedMotion } from '@/lib/hooks';
import { useHydrated } from '@/lib/useHydrated';
import { Approx, Co2e, Lettering, Marquee, Panel, Segmented, Tag, toast } from '@/ui';
import { SPECIES, type Species, type WorldSnapshot } from '@/world';
import { DEMO, SPECIES_LABEL, TICKER, stageLabel } from './copy';
import { DemoDock, DemoReadout, DragHint } from './demo';
import { Faq, FinalCta, HonestNumbers, HowItWorks, KindAndPrivate } from './lower';
import { DEMO_ANCHOR, estimateFor, type DemoAction } from './model';
import { StageSlot, StickerFlight } from './parts';
import { Hero, Problem, TimeLapse } from './story';
import { Tour } from './tour';
import { useDemo } from './useDemo';
import { useTimelapse } from './useTimelapse';

/** The demo grove is the same little island for every visitor. */
const DEMO_SEED = 12;
/** One toast for the whole demo: a second sticker replaces the first receipt instead of stacking. */
const RECEIPT_TOAST_ID = 'landing-demo-receipt';

const SPECIES_OPTIONS = SPECIES.map((species) => ({
  value: species,
  label: SPECIES_LABEL[species],
}));

/** The inline receipt is on screen, with room to be read. */
function readoutInView(): boolean {
  const box = document.getElementById(DEMO_ANCHOR)?.getBoundingClientRect();
  return box !== undefined && box.top < window.innerHeight - 48 && box.bottom > 0;
}

/** A receipt toast, for visitors whose inline receipt is below the fold (phones, mostly). */
function printReceipt(action: DemoAction) {
  if (readoutInView()) return;
  const estimate = estimateFor(action);
  toast({
    id: RECEIPT_TOAST_ID,
    title: DEMO.stuck,
    category: action.category,
    meta: estimate ? (
      <>
        <Approx weight="mono" />
        {estimate.text} <Co2e /> avoided vs. {estimate.comparedWith}
      </>
    ) : undefined,
  });
}

/**
 * The public landing page. The words are server HTML and paint first; the grove is one
 * persistent world that this page borrows three times: a demo tree the visitor grows by
 * sticking actions on, a first year scrubbed by scroll, and the same demo tree again at the
 * closing call to action. Nothing on this page touches saved game state.
 */
export default function LandingPage() {
  const hydrated = useHydrated();
  const wide = useBreakpoint('lg');
  const reduced = useReducedMotion();
  const desktop = hydrated && wide;
  const mobile = hydrated && !wide;

  const demo = useDemo(useCallback((action: DemoAction) => printReceipt(action), []));
  const lapse = useTimelapse(desktop, reduced);
  const [turned, setTurned] = useState(false);
  const onTouched = useCallback(() => setTurned(true), []);

  const { species } = demo;
  const base = useMemo<Partial<WorldSnapshot>>(
    () => ({ seed: DEMO_SEED, species, vitality: 1, props: [] }),
    [species],
  );
  const demoPreview = useMemo<Partial<WorldSnapshot>>(
    () => ({ ...base, growth: demo.status.growth, ageDays: 2 + demo.taps }),
    [base, demo.status.growth, demo.taps],
  );
  const lapsePreview = useMemo<Partial<WorldSnapshot>>(
    () => ({
      ...base,
      growth: lapse.moment.growth,
      hour: lapse.moment.hour,
      ageDays: lapse.moment.day,
    }),
    [base, lapse.moment.growth, lapse.moment.hour, lapse.moment.day],
  );

  const demoLabel = stageLabel(species, demo.status.stage, true);
  const lapseLabel = stageLabel(species, lapse.moment.stage, false);

  const speciesPicker = (className?: string) => (
    <Segmented<Species>
      size="sm"
      aria-label={DEMO.speciesLabel}
      value={species}
      onValueChange={demo.setSpecies}
      options={SPECIES_OPTIONS}
      className={className}
    />
  );

  /** Small chips at the stage's top edge: what this is, and that it can be turned. */
  const stageChips = (
    <div className="pointer-events-none absolute top-3 left-3 flex flex-col items-start gap-1.5 lg:top-28 lg:left-8 lg:flex-row lg:items-center lg:gap-2">
      <Tag hue="yellow">
        {DEMO.tag}
        {/* On the narrowest phones the species picker shares this edge and needs the room. */}
        <span className="max-[359px]:sr-only">{DEMO.tagDetail}</span>
      </Tag>
      <DragHint used={turned} />
    </div>
  );

  const stageFlash = demo.stageFlash ? (
    <p
      key={demo.stageFlash}
      aria-hidden="true"
      className="pointer-events-none absolute inset-x-0 bottom-16 animate-stick text-center text-display-lg lg:bottom-48"
    >
      <Lettering fill="green" sweep>
        {demo.stageFlash}
      </Lettering>
    </p>
  ) : null;

  const lapseFurniture = (
    <Tag hue="paper" className="absolute top-3 left-3 lg:top-28 lg:left-8">
      {lapse.moment.label}
    </Tag>
  );

  return (
    <>
      {/* Sections 1 to 3 share one stage on desktop: it stays pinned while the desk scrolls by. */}
      <div className="lg:grid lg:grid-cols-[min(62.5%,960px)_minmax(0,1fr)]">
        <div className="hidden lg:block">
          <StageSlot
            show={desktop}
            mode="hero"
            preview={lapse.engaged ? lapsePreview : demoPreview}
            label={lapse.engaged ? lapseLabel : demoLabel}
            anchor={lapse.engaged ? 'bottom' : 'center'}
            onTouched={onTouched}
            className="sticky top-0 h-dvh"
          >
            {lapse.engaged ? (
              lapseFurniture
            ) : (
              <>
                {stageChips}
                {stageFlash}
                <DemoDock
                  demo={demo}
                  extra={speciesPicker()}
                  className="absolute bottom-7 left-1/2 w-max max-w-[calc(100%-3rem)] -translate-x-1/2"
                />
              </>
            )}
          </StageSlot>
        </div>

        <div className="min-w-0 lg:edge-pinked-l">
          <div className="lg:pt-28 lg:pr-10 lg:pl-11">
            <Hero />
          </div>
          <StageSlot
            show={mobile}
            mode="hero"
            preview={demoPreview}
            label={demoLabel}
            onTouched={onTouched}
            className="h-[clamp(200px,calc(100svh-540px),340px)] lg:hidden"
          >
            {stageChips}
            {speciesPicker('absolute top-3 right-3')}
            {stageFlash}
          </StageSlot>
          <div className="max-lg:edge-pinked-t">
            {/* On a phone the tray straddles the foot of the stage: tree and stickers in one glance. */}
            {desktop ? null : (
              <div className="relative -top-11 z-(--z-content) -mb-11 px-gutter lg:hidden">
                <DemoDock demo={demo} className="mx-auto max-w-[30rem]" />
              </div>
            )}
            <div className="pt-4 px-gutter lg:pt-0 lg:pr-10 lg:pl-11">
              <DemoReadout demo={demo} />
            </div>
          </div>
          <div className="lg:pr-10 lg:pl-11">
            <Problem />
          </div>
          <div className="lg:pr-10 lg:pl-11">
            <TimeLapse
              sectionRef={lapse.sectionRef}
              listRef={lapse.listRef}
              moment={lapse.moment}
              stage={
                <StageSlot
                  show={mobile}
                  mode="hero"
                  preview={lapsePreview}
                  label={lapseLabel}
                  className="h-[46dvh] shrink-0 lg:hidden"
                >
                  {lapseFurniture}
                </StageSlot>
              }
            />
          </div>
        </div>
      </div>

      <Marquee
        variant="ticker"
        title="How Touch Grass works, in four paper verbs: peel, stick, stamp, tear"
        items={[...TICKER]}
        // The words are a moving repeat of the label above: nothing in the strip is a target.
        className="relative z-(--z-content) *:pointer-events-none"
      />

      {/* The desk: opaque, so the grove never shows through the reading sections. */}
      <Panel variant="mat">
        <HowItWorks />
        <HonestNumbers />
        <KindAndPrivate />
        <Tour />
        <Faq />
      </Panel>

      <FinalCta
        grown={demo.taps > 0}
        stage={
          <div className="hidden lg:block">
            <StageSlot
              show={desktop}
              mode="hero"
              priority={1}
              preview={demoPreview}
              label={demoLabel}
              className="h-[70dvh] min-h-[420px]"
            />
          </div>
        }
        mobileStage={
          <StageSlot
            show={mobile}
            mode="hero"
            priority={1}
            preview={demoPreview}
            label={demoLabel}
            className="h-[clamp(280px,52dvh,460px)] lg:hidden"
          />
        }
      />

      {demo.flights.map((flight) => (
        <StickerFlight
          key={flight.key}
          flight={flight}
          onLand={demo.landFlight}
          onEnd={demo.endFlight}
        />
      ))}
    </>
  );
}
