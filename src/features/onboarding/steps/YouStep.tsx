'use client';

import { ArrowRight } from 'lucide-react';
import { NAME_MAX } from '@/game';
import { Button, Field, Input } from '@/ui';
import { RegionField } from '../components/RegionPicker';
import { StepFrame } from '../components/StepFrame';
import { COPY } from '../copy';
import type { OnboardingFlow } from '../useOnboardingFlow';

/** Name (optional) and home region (optional). Neither ever leaves the device. */
export function YouStep({ flow }: { flow: OnboardingFlow }) {
  const { draft, change } = flow;
  return (
    <StepFrame
      slug={COPY.you.slug}
      title={COPY.you.title}
      onSubmit={flow.next}
      footer={
        <Button type="submit" variant="primary" size="lg" iconRight={ArrowRight} fullWidth>
          {COPY.next}
        </Button>
      }
    >
      <Field label={COPY.you.nameLabel} hint={COPY.you.nameHint}>
        <Input
          value={draft.name}
          onChange={(event) => change({ type: 'name', value: event.target.value })}
          placeholder={COPY.you.namePlaceholder}
          maxLength={NAME_MAX}
          autoComplete="given-name"
          autoCapitalize="words"
          enterKeyHint="next"
          spellCheck={false}
        />
      </Field>
      <RegionField
        label={COPY.you.homeLabel}
        reason={COPY.you.homeReason}
        value={draft.region}
        onChange={(region) => change({ type: 'region', region })}
      />
    </StepFrame>
  );
}
