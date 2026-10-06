'use client';

import { Button } from '@/ui';
import { StepFrame } from '../components/StepFrame';
import { COPY } from '../copy';
import type { OnboardingFlow } from '../useOnboardingFlow';

/**
 * Shown only when the earlier version of the app left real logs in this browser. Nothing is
 * imported or thrown away here: the choice takes effect when the tree is planted, so Back
 * can still change it.
 */
export function LegacyStep({ flow }: { flow: OnboardingFlow }) {
  const choose = (choice: 'bring' | 'fresh') => {
    // The first screen is stored as "promise" while this question stands in front of it, so
    // answering already uncovers it; moving on as well would skip it. After Back, the draft
    // itself sits here and does need the move.
    const standsInFront = flow.draft.screen !== flow.screen;
    flow.change({ type: 'legacy', choice });
    if (!standsInFront) flow.next();
  };
  const chosen = flow.draft.legacy;

  return (
    <StepFrame
      slug={COPY.legacy.slug}
      title={COPY.legacy.title}
      lead={COPY.legacy.body(flow.legacyLogs)}
      onSubmit={() => choose('bring')}
      footer={
        <>
          <Button
            type="submit"
            variant={chosen === 'fresh' ? 'neutral' : 'primary'}
            size="lg"
            fullWidth
            aria-pressed={chosen === 'bring' || undefined}
          >
            {COPY.legacy.bring}
          </Button>
          <Button
            type="button"
            variant={chosen === 'fresh' ? 'primary' : 'neutral'}
            size="lg"
            fullWidth
            aria-pressed={chosen === 'fresh' || undefined}
            onClick={() => choose('fresh')}
          >
            {COPY.legacy.fresh}
          </Button>
        </>
      }
    >
      <p className="text-body-sm text-pretty text-ink-2">{COPY.legacy.placeholders}</p>
    </StepFrame>
  );
}
