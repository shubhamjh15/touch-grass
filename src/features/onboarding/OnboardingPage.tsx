'use client';

import { ArrowLeft } from 'lucide-react';
import { useEffect, useRef, type ReactNode } from 'react';
import { BRAND } from '@/lib/brand';
import { ColorBar, IconButton, Panel, TapeNote } from '@/ui';
import { Ceremony } from './Ceremony';
import { GroveStage } from './components/GroveStage';
import { StepHeadingContext } from './components/StepFrame';
import { COPY } from './copy';
import { PROGRESS_STEPS, progressOf, questionOf, type ScreenId } from './flow';
import { ComfortStep } from './steps/ComfortStep';
import { FocusStep } from './steps/FocusStep';
import { LegacyStep } from './steps/LegacyStep';
import { LineStep } from './steps/LineStep';
import { PromiseStep } from './steps/PromiseStep';
import { QuizQuestionStep, QuizRegionStep } from './steps/QuizStep';
import { ResultStep } from './steps/ResultStep';
import { TreeStep } from './steps/TreeStep';
import { YouStep } from './steps/YouStep';
import { useOnboardingFlow, type OnboardingFlow } from './useOnboardingFlow';

/** The browser tab and the history list name the screen, not just the flow. */
function titleOf(screen: ScreenId): string {
  switch (screen) {
    case 'legacy':
      return COPY.legacy.slug;
    case 'promise':
      return 'Plant your tree';
    case 'you':
      return 'About you';
    case 'tree':
      return 'Your tree';
    case 'line':
      return 'Starting line';
    case 'result':
      return COPY.result.title;
    case 'focus':
      return 'Focus areas';
    case 'comfort':
      return 'Comfort';
    case 'ceremony':
      return 'Plant the seed';
    default:
      return 'Starting-line quiz';
  }
}

function Step({ flow }: { flow: OnboardingFlow }): ReactNode {
  const { screen } = flow;
  const question = questionOf(screen);
  if (question) return <QuizQuestionStep flow={flow} question={question} />;
  switch (screen) {
    case 'legacy':
      return <LegacyStep flow={flow} />;
    case 'promise':
      return <PromiseStep flow={flow} />;
    case 'you':
      return <YouStep flow={flow} />;
    case 'tree':
      return <TreeStep flow={flow} />;
    case 'line':
      return <LineStep flow={flow} />;
    case 'quiz-region':
      return <QuizRegionStep flow={flow} />;
    case 'result':
      return <ResultStep flow={flow} />;
    case 'focus':
      return <FocusStep flow={flow} />;
    case 'comfort':
      return <ComfortStep flow={flow} />;
    default:
      return null;
  }
}

function Stepper({ screen, className }: { screen: ScreenId; className?: string }) {
  const step = progressOf(screen);
  return (
    <ColorBar
      step={step}
      steps={PROGRESS_STEPS}
      size="sm"
      label={
        step === 0 ? `${PROGRESS_STEPS} short steps ahead` : `Step ${step} of ${PROGRESS_STEPS}`
      }
      className={className}
    />
  );
}

/**
 * First run, route `/start`: name, tree, the optional starting line, focus areas, comfort
 * settings, then the seed-planting ceremony. No navigation, no account, nothing sent anywhere.
 * The grove sits where Today's stage will be, so planting ends with the tree already in place.
 */
export default function OnboardingPage() {
  const flow = useOnboardingFlow();
  const { screen } = flow;
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    document.title = `${titleOf(screen)} · ${BRAND.name}`;
  }, [screen]);

  // A new screen starts at the top with its question in focus, so it is announced and the
  // next Tab lands on its first control. The very first screen is left to the browser.
  const shown = useRef(screen);
  useEffect(() => {
    if (shown.current === screen) return;
    shown.current = screen;
    window.scrollTo(0, 0);
    headingRef.current?.focus({ preventScroll: true });
  }, [screen]);

  if (screen === 'ceremony') return <Ceremony flow={flow} />;

  return (
    <div className="relative lg:flex lg:min-h-dvh">
      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between p-3 pt-[calc(var(--safe-t)+12px)] lg:fixed lg:right-auto lg:p-6">
        <span className="pointer-events-auto">
          {flow.canGoBack ? (
            <IconButton
              label={COPY.back}
              icon={ArrowLeft}
              tooltipSide="right"
              onClick={flow.back}
            />
          ) : null}
        </span>
        <span className="pointer-events-auto inline-flex h-11 items-center rounded-pill border-3 border-ink bg-white px-3.5 shadow-2 lg:hidden">
          <Stepper screen={screen} />
        </span>
      </div>

      <GroveStage
        screen={screen}
        draft={flow.draft}
        className="sticky top-0 h-[40dvh] min-h-[272px] w-full lg:h-dvh lg:w-[62.5%] lg:max-w-[960px] lg:shrink-0"
      />

      <Panel
        variant="mat"
        className="flex min-h-[60dvh] min-w-0 flex-1 flex-col pt-7 px-gutter pb-[max(32px,var(--safe-b))] lg:edge-pinked-l lg:min-h-dvh lg:px-11 lg:pt-10 lg:pb-12"
      >
        <div aria-hidden="true" className="absolute inset-x-0 top-0 lg:hidden">
          <div className="edge-pinked-t" />
        </div>
        <div className="mx-auto hidden w-full max-w-[460px] items-center gap-3 lg:flex">
          <Stepper screen={screen} />
        </div>
        <div className="mx-auto flex w-full max-w-[460px] flex-1 flex-col lg:my-auto lg:flex-none lg:py-10">
          {flow.persisted ? null : (
            <TapeNote tone="yellow" tape="pink" rotate={-1} className="mb-7" role="status">
              {COPY.storage}
            </TapeNote>
          )}
          <StepHeadingContext value={headingRef}>
            <div key={screen} className="flex flex-1 flex-col motion-safe:animate-stick">
              <Step flow={flow} />
            </div>
          </StepHeadingContext>
        </div>
      </Panel>
    </div>
  );
}
