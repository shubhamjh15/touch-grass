'use client';

import { ArrowRight } from 'lucide-react';
import { useId, type ReactNode } from 'react';
import { gameActions, useSettings } from '@/game';
import { play, setSoundEnabled } from '@/lib/sfx';
import { Button, Card, Segmented, Switch, type SegmentedOption } from '@/ui';
import { useWorldStore, type WorldMotion } from '@/world';
import { StepFrame } from '../components/StepFrame';
import { COPY } from '../copy';
import type { OnboardingFlow } from '../useOnboardingFlow';

/** Onboarding offers three of the five graphics settings; the finer tiers live in Me. */
type Grove = 'auto' | 'low' | 'off';

const MOTION: readonly SegmentedOption<WorldMotion>[] = [
  { value: 'system', label: 'System' },
  { value: 'reduced', label: 'Reduced' },
  { value: 'full', label: 'Full' },
];

const GROVE: readonly SegmentedOption<Grove>[] = [
  { value: 'auto', label: '3D' },
  { value: 'low', label: 'Light 3D' },
  { value: 'off', label: 'Still' },
];

function Row({ title, line, children }: { title: string; line: string; children: ReactNode }) {
  const titleId = useId();
  return (
    <div className="flex flex-col gap-2.5 px-4 py-3.5" role="group" aria-labelledby={titleId}>
      <div>
        <p id={titleId} className="text-body font-semibold text-ink">
          {title}
        </p>
        <p className="mt-0.5 text-body-sm text-ink-2" aria-live="polite">
          {line}
        </p>
      </div>
      {children}
    </div>
  );
}

/**
 * Sound, motion and 3D, each applied the moment it is changed, so the stage beside the
 * controls is the preview. These are ordinary settings: they are saved at once, not at planting.
 */
export function ComfortStep({ flow }: { flow: OnboardingFlow }) {
  const settings = useSettings();
  const worldStatus = useWorldStore((state) => state.status);
  const grove: Grove =
    settings.graphics === 'off' ? 'off' : settings.graphics === 'low' ? 'low' : 'auto';
  // The browser has no WebGL, whatever the setting says.
  const noWebgl = worldStatus === 'fallback' && settings.graphics !== 'off';

  return (
    <StepFrame
      slug={COPY.comfort.slug}
      title={COPY.comfort.title}
      onSubmit={flow.next}
      footer={
        <Button type="submit" variant="primary" size="lg" iconRight={ArrowRight} fullWidth>
          {COPY.comfort.cta}
        </Button>
      }
    >
      <Card padded={false} className="divide-y-[1.5px] divide-ink">
        <div className="px-4 py-2">
          <Switch
            label={COPY.comfort.sound}
            description={COPY.comfort.soundLine}
            checked={settings.sound}
            onCheckedChange={(sound) => {
              gameActions.updateSettings({ sound });
              // The sample is the answer to "what does it sound like?", so it must not wait
              // for the setting to travel through the shell.
              setSoundEnabled(sound);
              if (sound) play('leaf', { count: 3 });
            }}
          />
        </div>
        <Row title={COPY.comfort.motion} line={COPY.comfort.motionLine[settings.motion]}>
          <Segmented
            aria-label={COPY.comfort.motion}
            options={MOTION}
            value={settings.motion}
            onValueChange={(motion) => {
              play('toggle');
              gameActions.updateSettings({ motion });
            }}
            fullWidth
          />
        </Row>
        <Row
          title={COPY.comfort.graphics}
          line={noWebgl ? COPY.comfort.noWebgl : COPY.comfort.graphicsLine[grove]}
        >
          <Segmented
            aria-label={COPY.comfort.graphics}
            options={GROVE}
            value={grove}
            onValueChange={(graphics) => {
              play('toggle');
              gameActions.updateSettings({ graphics });
            }}
            fullWidth
          />
        </Row>
      </Card>
      <p className="text-caption text-ink-3">{COPY.comfort.later}</p>
    </StepFrame>
  );
}
