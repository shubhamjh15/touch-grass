'use client';

import { useCallback, useMemo } from 'react';
import { useBreakpoint, useReducedMotion } from '@/lib/hooks';
import { useHydrated } from '@/lib/useHydrated';
import { Approx, Co2e, Lettering, Marquee, Segmented, Tag, toast } from '@/ui';
import { SPECIES, type Species, type WorldSnapshot } from '@/world';
import { DEMO, SPECIES_LABEL, TICKER, stageLabel } from './copy';
import { Faq, FinalCta, HonestNumbers, HowItWorks, KindAndPrivate } from './lower';
import { estimateFor, type DemoAction } from './model';
import { StageSlot, StickerFlight } from './parts';
import { DemoPanel, Hero, Problem, TimeLapse } from './story';
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

function printReceipt(action: DemoAction) {
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

  const demoFurniture = (
    <>
      <Tag hue="yellow" className="absolute bottom-3 left-3 lg:bottom-12 lg:left-12">
        {DEMO.tag}
      </Tag>
      <Segmented<Species>
        size="sm"
        aria-label={DEMO.speciesLabel}
        value={species}
        onValueChange={demo.setSpecies}
        options={SPECIES_OPTIONS}
        className="absolute top-3 right-3 lg:top-auto lg:right-12 lg:bottom-10"
      />
      {demo.stageFlash ? (
        <p
          key={demo.stageFlash}
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-[18%] animate-stick text-center text-display-lg"
        >
          <Lettering fill="green" sweep>
            {demo.stageFlash}
          </Lettering>
        </p>
      ) : null}
    </>
  );

  const lapseFurniture = (
    <Tag hue="paper" className="absolute bottom-3 left-3 lg:bottom-12 lg:left-12">
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
            className="sticky top-0 h-dvh"
          >
            {lapse.engaged ? lapseFurniture : demoFurniture}
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
            className="h-[clamp(200px,calc(100svh-600px),300px)] lg:hidden"
          >
            {demoFurniture}
          </StageSlot>
          <div className="pt-5 px-gutter max-lg:edge-pinked-t lg:pt-0 lg:pr-10 lg:pl-11">
            <DemoPanel demo={demo} />
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
        className="relative z-(--z-content)"
      />

      <HowItWorks />
      <HonestNumbers />
      <KindAndPrivate />
      <Tour />
      <Faq />

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
