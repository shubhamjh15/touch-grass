'use client';

import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useRef, type ReactNode } from 'react';
import { ROUTES } from '@/app/routes';
import { useIsOnboarded } from '@/game';
import { Button, Meter } from '@/ui';
import { StepHeadingContext } from './components/stepHeading';
import { COPY } from './copy';
import { progressOf, questionOf } from './flow';
import { LegacyStep } from './steps/LegacyStep';
import { LineStep } from './steps/LineStep';
import { NameStep } from './steps/NameStep';
import { PlantStep } from './steps/PlantStep';
import { QuizStep } from './steps/QuizStep';
import { ResultStep } from './steps/ResultStep';
import { TreeStep } from './steps/TreeStep';
import { useOnboardingFlow, type OnboardingFlow } from './useOnboardingFlow';

function Step({ flow }: { flow: OnboardingFlow }): ReactNode {
  const { screen } = flow;
  const question = questionOf(screen);
  if (question) return <QuizStep flow={flow} question={question} />;
  switch (screen) {
    case 'legacy':
      return <LegacyStep flow={flow} />;
    case 'name':
      return <NameStep flow={flow} />;
    case 'tree':
      return <TreeStep flow={flow} />;
    case 'line':
      return <LineStep flow={flow} />;
    case 'result':
      return <ResultStep flow={flow} />;
    case 'plant':
      return <PlantStep flow={flow} />;
    default:
      return null;
  }
}

/**
 * First run, route `/start`: one question per screen. A name, a tree, the optional
 * starting-line quiz, then the seed is planted and Today opens. No navigation, no account,
 * nothing sent anywhere; everything typed survives a reload until the tree is planted.
 */
export default function OnboardingPage() {
  const flow = useOnboardingFlow();
  const { screen } = flow;
  const planted = useIsOnboarded();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const percent = Math.round(progressOf(screen) * 100);

  // A new screen starts at the top with its question in focus, so it is announced and the
  // next Tab lands on its first control. The very first screen is left to the browser.
  const shown = useRef(screen);
  useEffect(() => {
    if (shown.current === screen) return;
    shown.current = screen;
    window.scrollTo(0, 0);
    headingRef.current?.focus({ preventScroll: true });
  }, [screen]);

  return (
    <div className="flex min-h-dvh flex-col bg-mat">
      <div className="mx-auto flex h-14 w-full max-w-[600px] shrink-0 items-center gap-3 pt-(--safe-t) px-gutter sm:mt-6">
        {/* Planting cannot be undone, so the way back goes with it. */}
        <span className="flex w-20 shrink-0">
          {planted ? null : flow.canGoBack ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              icon={ArrowLeft}
              className="-ml-2"
              onClick={flow.back}
            >
              {COPY.back}
            </Button>
          ) : (
            <Button asChild variant="ghost" size="sm" icon={ArrowLeft} className="-ml-2">
              <Link href={ROUTES.landing}>{COPY.back}</Link>
            </Button>
          )}
        </span>
        <Meter
          role="progressbar"
          size="sm"
          value={percent}
          max={100}
          label="Setting up"
          valueText={`${percent}% done`}
          className="min-w-0 flex-1"
        />
      </div>

      <div className="mx-auto flex w-full max-w-[600px] flex-1 flex-col pt-6 px-gutter pb-[max(24px,var(--safe-b))] sm:pt-12 sm:pb-16">
        {flow.persisted ? null : (
          <p role="status" className="mb-6 text-body-sm text-ink-3">
            {COPY.storage}
          </p>
        )}
        <StepHeadingContext value={headingRef}>
          <div
            key={screen}
            className="flex flex-1 flex-col transition-[opacity,translate] duration-(--dur-base) ease-out starting:translate-y-2 starting:opacity-0 calm:starting:translate-y-0"
          >
            <Step flow={flow} />
          </div>
        </StepHeadingContext>
      </div>
    </div>
  );
}
