'use client';

import { Plus } from 'lucide-react';
import { useState } from 'react';
import { formatCo2Parts } from '@/lib/format';
import { Button } from '../Button';
import { Card } from '../Card';
import { Co2e } from '../Co2e';
import { Meter } from '../Meter';
import { ProgressBar } from '../ProgressBar';
import { RingProgress } from '../RingProgress';
import { Spinner } from '../Spinner';
import { StatReadout } from '../StatReadout';
import { EmptyState, ErrorState, OfflineBanner, Skeleton } from '../states';
import { XPBar } from '../XPBar';
import { Chapter, Demo, Spec } from './parts';
import { SAMPLE_SOURCE } from './sample';

function XpDemo() {
  const [xp, setXp] = useState(425);
  const [earned, setEarned] = useState(0);
  return (
    <div className="grid w-full max-w-md gap-3">
      <XPBar level={5} xp={xp} xpForNext={600} justEarned={earned} />
      <div className="flex gap-3">
        <Button
          size="sm"
          icon={Plus}
          onClick={() => {
            setEarned(30);
            setXp((value) => Math.min(value + 30, 600));
          }}
        >
          Earn 30 XP
        </Button>
        <Button
          variant="link"
          size="sm"
          onClick={() => {
            setEarned(0);
            setXp(425);
          }}
        >
          Reset
        </Button>
      </div>
    </div>
  );
}

function QuestRowDemo() {
  const [claimed, setClaimed] = useState(false);
  return (
    <Card padded={false} className="w-full max-w-xl divide-y divide-line">
      <div className="flex items-center gap-4 px-5 py-4">
        <div className="min-w-0 flex-1">
          <p className="text-body font-semibold">Log two actions</p>
          <ProgressBar
            value={1}
            max={2}
            label="Log two actions"
            valueText="1 of 2"
            className="mt-2.5"
          />
        </div>
        <p className="shrink-0 text-body-sm font-semibold text-ink-3">+40 XP</p>
      </div>
      <div className="flex items-center gap-4 px-5 py-4">
        <div className="min-w-0 flex-1">
          <p className="text-body font-semibold">Take a Touch grass break</p>
          <ProgressBar
            value={1}
            max={1}
            label="Take a Touch grass break"
            valueText="1 of 1"
            className="mt-2.5"
          />
        </div>
        <Button
          variant="reward"
          size="sm"
          success={claimed}
          className="shrink-0"
          onClick={() => setClaimed((value) => !value)}
        >
          {claimed ? 'Claimed' : 'Claim 30 XP'}
        </Button>
      </div>
    </Card>
  );
}

export function DataChapter() {
  const [retries, setRetries] = useState(0);
  const total = formatCo2Parts(38.4);

  return (
    <Chapter
      id="data"
      title="Numbers and progress"
      rule="At most three numbers on a screen. Progress is a thin bar; nothing pulses, shimmers or counts by itself."
    >
      <Demo
        title="Three numbers"
        note="One row of three, and that is the budget for the screen."
        className="gap-x-12"
      >
        <StatReadout
          size="lg"
          label="avoided in total"
          value={total.value}
          unit={
            <>
              {total.unit} <Co2e />
            </>
          }
          source={SAMPLE_SOURCE}
        />
        <StatReadout
          size="lg"
          label="this week"
          value="4.2"
          unit="kg"
          approx
          delta={{ dir: 'up', text: '0.8 kg more than last week' }}
        />
        <StatReadout size="lg" label="day streak" value={12} />
      </Demo>

      <Demo
        title="Thin progress bar"
        note="Reading progress and onboarding steps use the thin line; quest rows use the outlined bar."
        className="flex-col gap-y-4"
      >
        <ProgressBar
          size="thin"
          value={2}
          max={4}
          label="Step 2 of 4"
          valueText="Step 2 of 4"
          className="max-w-md"
        />
        <ProgressBar
          value={3}
          max={5}
          label="Walk 5 km"
          valueText="3 of 5 km"
          className="max-w-md"
        />
      </Demo>

      <Demo
        title="A quest row"
        note="Title, a thin bar, the reward. A claim button appears when it is complete."
      >
        <QuestRowDemo />
      </Demo>

      <Demo title="Level and XP">
        <XpDemo />
      </Demo>

      <Demo title="Meter and ring" className="items-center gap-x-8">
        <Meter value={3} max={5} label="Daily cap" pips />
        <Meter value={34} max={50} label="Fifty logs" className="w-40" />
        <RingProgress value={2} max={3} label="Lesson progress" size={48}>
          2/3
        </RingProgress>
        <RingProgress value={3} max={3} label="Lesson progress" size={48} />
        <RingProgress value={45} max={120} label="Break timer" size={96} tone="blue" keepChildren>
          <span className="text-h2 tabular-nums">1:15</span>
        </RingProgress>
      </Demo>

      <Demo
        title="Loading"
        note="One spinner, shown only while something is really loading. Skeletons are still: they hold the space, they do not shimmer."
        className="items-center gap-x-8"
      >
        <Spec name="Spinner">
          <Spinner size={24} />
        </Spec>
        <div aria-busy="true" className="w-full max-w-sm">
          <Card padded={false}>
            <Skeleton shape="row" />
            <Skeleton shape="row" className="border-t border-line" />
          </Card>
        </div>
        <Skeleton shape="text" lines={3} className="w-56" />
      </Demo>

      <Demo
        title="Nothing yet"
        note="A friendly sentence and one button. Never an empty chart or an empty list."
      >
        <Card padded={false} className="w-full max-w-xl">
          <EmptyState
            title="Your first week starts here"
            body="Log one action and this page begins to fill in."
            action={<Button variant="primary">Log an action</Button>}
          />
        </Card>
      </Demo>

      <Demo title="Something went wrong" note="Calm, specific, with a way forward.">
        <ErrorState
          body={
            retries > 0
              ? `Still no luck after ${retries} ${retries === 1 ? 'try' : 'tries'}.`
              : "This page couldn't load."
          }
          onRetry={() => setRetries((value) => value + 1)}
          details="TypeError: sample details for the workbench"
          className="w-full max-w-xl"
        />
      </Demo>

      <Demo title="Offline">
        <OfflineBanner offline />
      </Demo>
    </Chapter>
  );
}
