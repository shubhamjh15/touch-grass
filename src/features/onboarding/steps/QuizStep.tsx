'use client';

import { useCallback, useEffect, useRef } from 'react';
import { BASELINE_QUESTIONS, type BaselineQuestionId } from '@/data/catalogue';
import { play } from '@/lib/sfx';
import { Button } from '@/ui';
import { ChoiceButton } from '../components/ChoiceButton';
import { StepFrame } from '../components/StepFrame';
import { COPY, QUESTION_COPY, splitOptionLabel } from '../copy';
import { quizPosition } from '../flow';
import type { OnboardingFlow } from '../useOnboardingFlow';

/** Long enough to see the answer take, short enough to keep the quiz at a minute. */
const ADVANCE_MS = 260;

/**
 * One question of the starting-line quiz: tap an answer and the quiz moves on by itself.
 * Coming back to an answered question shows a Continue button, so nothing has to be re-tapped.
 */
export function QuizStep({
  flow,
  question,
}: {
  flow: OnboardingFlow;
  question: BaselineQuestionId;
}) {
  const { draft, change, next, goTo } = flow;
  const definition = BASELINE_QUESTIONS.find((entry) => entry.id === question);
  const answer = draft.answers[question];
  const position = quizPosition(flow.screen);
  const copy = QUESTION_COPY[question];

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

  const skip = () => {
    cancel();
    change({ type: 'quiz-skip' });
    goTo('plant');
  };

  if (!definition) return null;

  return (
    <StepFrame
      eyebrow={position ? COPY.quiz.position(position.index, position.total) : undefined}
      title={copy.title}
      lead={copy.lead}
      onSubmit={next}
      footer={
        <>
          {answer !== undefined ? (
            <Button type="submit" variant="primary" size="lg" fullWidth>
              {COPY.next}
            </Button>
          ) : null}
          <Button type="button" variant="ghost" size="md" className="self-center" onClick={skip}>
            {COPY.quiz.skip}
          </Button>
        </>
      }
    >
      <div role="group" aria-label={definition.prompt} className="flex flex-col gap-2.5">
        {definition.options.map((option) => {
          const { title, detail } = splitOptionLabel(option.label);
          return (
            <ChoiceButton
              key={option.id}
              title={title}
              detail={detail}
              selected={answer === option.id}
              onClick={() => pick(option.id)}
            />
          );
        })}
      </div>
    </StepFrame>
  );
}
