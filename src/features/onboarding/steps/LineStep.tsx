'use client';

import { ClipboardList, SkipForward } from 'lucide-react';
import { pluralize } from '@/lib/format';
import { ChoiceButton } from '../components/ChoiceButton';
import { StepFrame } from '../components/StepFrame';
import { COPY } from '../copy';
import { QUIZ_QUESTION_IDS, answeredCount, quizResumeScreen } from '../flow';
import type { OnboardingFlow } from '../useOnboardingFlow';

/** Take the starting-line quiz, or skip it. Skipping costs nothing, now or later. */
export function LineStep({ flow }: { flow: OnboardingFlow }) {
  const { draft, change, goTo, next } = flow;
  const answered = answeredCount(draft);
  const total = QUIZ_QUESTION_IDS.length;
  const complete = answered === total;
  // The same rule the draft applies when the quiz opens: no region yet, so it asks first.
  const asksRegion =
    draft.quiz === 'undecided' || draft.quiz === 'skipped'
      ? !draft.regionSet
      : draft.quizAsksRegion;

  const take = () => {
    change({ type: 'quiz-start' });
    // A fresh quiz starts at its first screen; a paused one where it stopped.
    if (answered > 0) goTo(quizResumeScreen(draft));
    else next();
  };
  const skip = () => {
    change({ type: 'quiz-skip' });
    next();
  };

  const takeTitle = complete ? COPY.line.review : answered > 0 ? COPY.line.resume : COPY.line.take;
  const takeLine = complete
    ? COPY.line.reviewLine
    : answered > 0
      ? `${pluralize(answered, 'answer')} kept. ${pluralize(total - answered, 'question')} to go.`
      : COPY.line.takeLine(total + (asksRegion ? 1 : 0));

  return (
    <StepFrame slug={COPY.line.slug} title={COPY.line.title} lead={COPY.line.lead} onSubmit={take}>
      <div className="flex flex-col gap-3">
        <ChoiceButton
          type="submit"
          icon={ClipboardList}
          tone="blue"
          title={takeTitle}
          detail={takeLine}
          selected={draft.quiz === 'taking' || draft.quiz === 'done'}
        />
        <ChoiceButton
          icon={SkipForward}
          title={COPY.line.skip}
          detail={COPY.line.skipLine}
          selected={draft.quiz === 'skipped' || draft.quiz === 'paused'}
          onClick={skip}
        />
      </div>
    </StepFrame>
  );
}
