'use client';

import { useState } from 'react';
import { NAME_MAX } from '@/game';
import { Button, Field, Input } from '@/ui';
import { StepFrame } from '../components/StepFrame';
import { COPY } from '../copy';
import { pendingChallenge } from '../handover';
import type { OnboardingFlow } from '../useOnboardingFlow';

/** The first question: a name, which is optional and never leaves the device. */
export function NameStep({ flow }: { flow: OnboardingFlow }) {
  const { draft, change } = flow;
  // Read once: the line must not flicker if storage changes under the page.
  const [challenge] = useState(pendingChallenge);

  return (
    <StepFrame
      title={COPY.name.title}
      lead={challenge ? COPY.challenge(challenge.from) : undefined}
      onSubmit={flow.next}
      footer={
        <Button type="submit" variant="primary" size="lg" fullWidth>
          {COPY.next}
        </Button>
      }
    >
      <Field label={COPY.name.label} hint={COPY.name.hint}>
        <Input
          value={draft.name}
          onChange={(event) => change({ type: 'name', value: event.target.value })}
          placeholder={COPY.name.placeholder}
          maxLength={NAME_MAX}
          autoComplete="given-name"
          autoCapitalize="words"
          enterKeyHint="next"
          spellCheck={false}
        />
      </Field>
    </StepFrame>
  );
}
