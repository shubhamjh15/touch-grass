'use client';

import { ArrowRight } from 'lucide-react';
import { useState } from 'react';
import { CATEGORIES } from '@/data/catalogue';
import { FOCUS_MAX } from '@/game';
import { play } from '@/lib/sfx';
import { Button, CATEGORY, Sticker } from '@/ui';
import { StepFrame } from '../components/StepFrame';
import { COPY } from '../copy';
import { draftSuggestedFocus } from '../flow';
import type { OnboardingFlow } from '../useOnboardingFlow';

/** Seven category stickers, one to three of them chosen. They tilt the quests, nothing more. */
export function FocusStep({ flow }: { flow: OnboardingFlow }) {
  const { draft, change } = flow;
  const [notice, setNotice] = useState<string | null>(null);
  const count = draft.focus.length;
  const fromQuiz = draft.quiz === 'done';
  const suggested = draftSuggestedFocus(draft);

  const toggle = (category: (typeof CATEGORIES)[number]['id']) => {
    const chosen = draft.focus.includes(category);
    if (!chosen && count >= FOCUS_MAX) {
      play('error');
      setNotice(COPY.focus.limit);
      return;
    }
    play(chosen ? 'peel' : 'stick');
    setNotice(null);
    change({ type: 'focus-toggle', category });
  };

  const submit = () => {
    const blocker = flow.next();
    if (blocker) setNotice(blocker);
  };

  return (
    <StepFrame
      slug={COPY.focus.slug}
      title={COPY.focus.title}
      lead={
        fromQuiz
          ? `${COPY.focus.caption} Your starting line points at ${suggested
              .map((category) => CATEGORY[category].label)
              .join(' and ')}.`
          : COPY.focus.caption
      }
      onSubmit={submit}
      footer={
        <Button
          type="submit"
          variant="primary"
          size="lg"
          iconRight={ArrowRight}
          fullWidth
          disabledReason={count === 0 ? COPY.focus.none : undefined}
        >
          {COPY.next}
        </Button>
      }
    >
      <div
        role="group"
        aria-label="Focus areas"
        className="mx-auto flex max-w-[380px] flex-wrap justify-center gap-x-3 gap-y-5 sm:gap-x-5"
      >
        {CATEGORIES.map((category) => (
          <Sticker
            key={category.id}
            category={category.id}
            size={66}
            label={CATEGORY[category.id].label}
            selected={draft.focus.includes(category.id)}
            onClick={() => toggle(category.id)}
          />
        ))}
      </div>
      <p className="flex min-h-6 flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <span className="font-mono text-data-sm text-ink-2">
          {count} of {FOCUS_MAX} picked
        </span>
        <span role="status" className="text-caption font-semibold text-ink">
          {notice}
        </span>
      </p>
    </StepFrame>
  );
}
