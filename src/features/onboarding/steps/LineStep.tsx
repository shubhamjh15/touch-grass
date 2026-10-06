'use client';

import { Button } from '@/ui';
import { StepFrame } from '../components/StepFrame';
import { COPY } from '../copy';
import { QUIZ_QUESTION_IDS, answeredCount, quizResumeScreen } from '../flow';
import type { OnboardingFlow } from '../useOnboardingFlow';

/** The first screen of the quiz: take it, or skip it. Skipping costs nothing, now or later. */
export function LineStep({ flow }: { flow: OnboardingFlow }) {
  const { draft, change, goTo, next } = flow;
  const answered = answeredCount(draft);
  const complete = answered === QUIZ_QUESTION_IDS.length;

  const take = () => {
    change({ type: 'quiz-start' });
    // A fresh quiz starts at its first question; a half-finished one where it stopped.
    if (answered > 0) goTo(quizResumeScreen(draft));
    else next();
  };
  const skip = () => {
    change({ type: 'quiz-skip' });
    next();
  };

  const takeLabel = complete ? COPY.line.review : answered > 0 ? COPY.line.resume : COPY.line.take;

  return (
    <StepFrame
      title={COPY.line.title}
      lead={COPY.line.lead}
      onSubmit={take}
      footer={
        <>
          <Button type="submit" variant="primary" size="lg" fullWidth>
            {takeLabel}
          </Button>
          <Button type="button" variant="neutral" size="lg" fullWidth onClick={skip}>
            {COPY.line.skip}
          </Button>
          <p className="text-center text-body-sm text-ink-3">{COPY.line.later}</p>
        </>
      }
    />
  );
}
