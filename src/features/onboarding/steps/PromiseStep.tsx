'use client';

import { ArrowRight, Heart, Lock, Scale, type LucideIcon } from 'lucide-react';
import { useState } from 'react';
import { Button, IconTile, Ledger, Lettering, ListRow, TapeNote, type Hue } from '@/ui';
import { StepFrame } from '../components/StepFrame';
import { COPY, PROMISES } from '../copy';
import { pendingChallenge } from '../handover';
import type { OnboardingFlow } from '../useOnboardingFlow';

const PROMISE_LOOK: Record<(typeof PROMISES)[number]['id'], { icon: LucideIcon; hue: Hue }> = {
  private: { icon: Lock, hue: 'blue' },
  honest: { icon: Scale, hue: 'yellow' },
  kind: { icon: Heart, hue: 'pink' },
};

/** The first screen: what the product is, and the three things it promises. */
export function PromiseStep({ flow }: { flow: OnboardingFlow }) {
  // Read once: the note must not flicker if storage changes under the page.
  const [challenge] = useState(pendingChallenge);

  return (
    <StepFrame
      slug={COPY.promise.foot}
      title={
        <Lettering fill="green" className="text-display-xl">
          {COPY.promise.lettering}
        </Lettering>
      }
      lead={COPY.promise.lead}
      onSubmit={flow.next}
      footer={
        <Button type="submit" variant="primary" size="lg" iconRight={ArrowRight} fullWidth>
          {COPY.promise.cta}
        </Button>
      }
    >
      <Ledger aria-label="What we promise">
        {PROMISES.map((promise) => {
          const { icon: Icon, hue } = PROMISE_LOOK[promise.id];
          return (
            <ListRow
              key={promise.id}
              leading={
                <IconTile hue={hue}>
                  <Icon size={20} strokeWidth={2.25} />
                </IconTile>
              }
              title={promise.title}
              description={promise.line}
            />
          );
        })}
      </Ledger>
      {challenge ? (
        <TapeNote tone="blue" tape="yellow" rotate={-1}>
          {COPY.challenge(challenge.from)}
        </TapeNote>
      ) : null}
    </StepFrame>
  );
}
