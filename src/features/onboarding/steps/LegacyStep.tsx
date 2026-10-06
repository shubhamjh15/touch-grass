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
    flow.change({ type: 'legacy', choice });
    // Answering is what opens the next screen, so there is nothing to step over: go to it.
    flow.goTo('name');
  };

  return (
    <StepFrame
      title={COPY.legacy.title}
      lead={COPY.legacy.lead(flow.legacyLogs)}
      onSubmit={() => choose('bring')}
      footer={
        <>
          <Button type="submit" variant="primary" size="lg" fullWidth>
            {COPY.legacy.bring}
          </Button>
          <Button
            type="button"
            variant="neutral"
            size="lg"
            fullWidth
            onClick={() => choose('fresh')}
          >
            {COPY.legacy.fresh}
          </Button>
        </>
      }
    />
  );
}
