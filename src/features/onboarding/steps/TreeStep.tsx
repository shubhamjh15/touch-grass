'use client';

import { Dices } from 'lucide-react';
import { useState } from 'react';
import { TREE_NAME_MAX } from '@/game';
import { play } from '@/lib/sfx';
import { Button, Field, Input } from '@/ui';
import { SpeciesPicker } from '../components/SpeciesPicker';
import { StepFrame } from '../components/StepFrame';
import { COPY } from '../copy';
import { treeNameError } from '../flow';
import type { OnboardingFlow } from '../useOnboardingFlow';

/** Species and name: three cards that each show their tree, and one field. */
export function TreeStep({ flow }: { flow: OnboardingFlow }) {
  const { draft, change } = flow;
  // The error waits until the user has tried to move on or has edited the field themselves.
  const [touched, setTouched] = useState(false);
  const error = touched ? treeNameError(draft) : null;

  const submit = () => {
    setTouched(true);
    flow.next();
  };

  return (
    <StepFrame
      title={COPY.tree.title}
      onSubmit={submit}
      footer={
        <Button type="submit" variant="primary" size="lg" fullWidth>
          {COPY.next}
        </Button>
      }
    >
      <SpeciesPicker
        value={draft.species}
        onChange={(species) => {
          play('toggle');
          change({ type: 'species', species });
        }}
      />
      <Field
        label={COPY.tree.nameLabel}
        hint={COPY.tree.nameHint}
        error={error ?? undefined}
        required
      >
        <div className="flex items-center gap-2.5">
          <Input
            className="min-w-0 flex-1"
            value={draft.treeName}
            onChange={(event) => {
              setTouched(true);
              change({ type: 'tree-name', value: event.target.value });
            }}
            maxLength={TREE_NAME_MAX}
            autoComplete="off"
            autoCapitalize="words"
            enterKeyHint="next"
            spellCheck={false}
          />
          <Button
            type="button"
            variant="neutral"
            size="md"
            icon={Dices}
            aria-label={COPY.tree.suggest}
            onClick={() => {
              play('tap');
              change({ type: 'suggest-name' });
            }}
          >
            Suggest
          </Button>
        </div>
      </Field>
    </StepFrame>
  );
}
