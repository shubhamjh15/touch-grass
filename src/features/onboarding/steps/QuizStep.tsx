'use client';

import { ArrowRight } from 'lucide-react';
import { useCallback, useEffect, useRef, type ReactNode } from 'react';
import { BASELINE_QUESTIONS, type BaselineQuestionId } from '@/data/catalogue';
import { play } from '@/lib/sfx';
import { Button, Meter } from '@/ui';
import { ChoiceButton } from '../components/ChoiceButton';
import { RegionList } from '../components/RegionPicker';
import { StepFrame } from '../components/StepFrame';
import { COPY, QUESTION_SLUG, milesHint, splitOptionLabel } from '../copy';
import { quizPosition, usesMiles } from '../flow';
import type { OnboardingFlow } from '../useOnboardingFlow';

/** Long enough to see the answer take, short enough to keep the quiz at a minute. */
const ADVANCE_MS = 260;

function QuizFrame({
  flow,
  slug,
  title,
  lead,
  answered,
  children,
}: {
  flow: OnboardingFlow;
  slug: string;
  title: string;
  lead?: string;
  /** Shows a Next button: the screen has an answer, so Enter may move on. */
  answered: boolean;
  children: ReactNode;
}) {
  const position = quizPosition(flow.screen, flow.draft);
  const finishLater = () => {
    flow.change({ type: 'quiz-pause' });
    flow.goTo('focus');
  };

  return (
    <StepFrame
      slug={`${COPY.quiz.slug} · ${slug}`}
      slugEnd={
        position ? (
          <span className="shrink-0 font-mono text-data-sm text-ink-2">
            {position.index} / {position.total}
          </span>
        ) : null
      }
      title={title}
      titleSize="h2"
      lead={lead}
      onSubmit={flow.next}
      footer={
        <>
          {answered ? (
            <Button type="submit" variant="primary" size="lg" iconRight={ArrowRight} fullWidth>
              {COPY.next}
            </Button>
          ) : null}
          <Button type="button" variant="ghost" size="md" onClick={finishLater}>
            {COPY.quiz.later}
          </Button>
        </>
      }
    >
      {position ? (
        <Meter
          pips
          value={position.index}
          max={position.total}
          tone="blue"
          label="Quiz progress"
          valueText={`Question ${position.index} of ${position.total}`}
          className="-mt-2"
        />
      ) : null}
      {children}
    </StepFrame>
  );
}

/** "Where's home?": asked inside the quiz only when it was not answered earlier. */
export function QuizRegionStep({ flow }: { flow: OnboardingFlow }) {
  return (
    <QuizFrame
      flow={flow}
      slug="Home"
      title={COPY.quiz.regionTitle}
      lead={COPY.quiz.regionLead}
      answered
    >
      <RegionList
        label={COPY.quiz.regionTitle}
        value={flow.draft.region}
        onChange={(region) => flow.change({ type: 'region', region })}
      />
    </QuizFrame>
  );
}

/** One question of the starting-line quiz: tap an answer and the quiz moves on by itself. */
export function QuizQuestionStep({
  flow,
  question,
}: {
  flow: OnboardingFlow;
  question: BaselineQuestionId;
}) {
  const { draft, change, next } = flow;
  const definition = BASELINE_QUESTIONS.find((entry) => entry.id === question);
  const answer = draft.answers[question];
  const miles = question === 'weeklyDistance' && usesMiles(draft.region);

  const timer = useRef<number | null>(null);
  const cancel = useCallback(() => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = null;
  }, []);
  useEffect(() => cancel, [cancel]);

  const pick = (option: string) => {
    play('tap');
    change({ type: 'answer', question, option });
    cancel();
    timer.current = window.setTimeout(() => {
      timer.current = null;
      next();
    }, ADVANCE_MS);
  };

  if (!definition) return null;

  return (
    <QuizFrame
      flow={flow}
      slug={QUESTION_SLUG[question]}
      title={definition.prompt}
      answered={answer !== undefined}
    >
      <div role="group" aria-label={definition.prompt} className="flex flex-col gap-2.5">
        {definition.options.map((option) => {
          const { title, detail } = splitOptionLabel(option.label);
          return (
            <ChoiceButton
              key={option.id}
              title={title}
              detail={miles ? milesHint(title) : detail}
              selected={answer === option.id}
              onClick={() => pick(option.id)}
            />
          );
        })}
      </div>
    </QuizFrame>
  );
}
