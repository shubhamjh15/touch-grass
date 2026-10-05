'use client';

import { ChevronRight, Droplet, RotateCcw, Settings, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { formatCo2Parts } from '@/lib/format';
import { Approx } from '../Approx';
import { Button } from '../Button';
import { Card } from '../Card';
import { Co2e } from '../Co2e';
import type { EstimateSource } from '../estimate';
import { HonestyMark } from '../HonestyMark';
import { IconButton } from '../IconButton';
import { IconTile, Ledger, ListRow } from '../Ledger';
import { Meter } from '../Meter';
import { NumberTicker } from '../NumberTicker';
import { RingProgress } from '../RingProgress';
import { StatReadout } from '../StatReadout';
import { Sticker } from '../Sticker';
import { Tag } from '../Tag';
import { Ticket } from '../Ticket';
import { XPBar } from '../XPBar';
import { Demo, Section, Spec } from './parts';

/** Illustrative only: real sources come from the evidence table through the game engine. */
const SAMPLE_SOURCE: EstimateSource = {
  code: 'MOVE-02',
  kind: 'factor',
  formula: '5 km × 0.171 kg/km = 0.86 kg',
  comparedWith: 'Compared with driving the same trip alone in an average petrol car.',
  range: '0.6–1.1 kg',
  sourceLabel: 'Sample dataset',
  year: 2024,
  href: '#data',
};

const AI_SOURCE: EstimateSource = {
  ...SAMPLE_SOURCE,
  code: 'CUSTOM',
  kind: 'ai',
  formula: '1 repair ≈ 4 kg (new kettle not bought)',
  comparedWith: 'Compared with buying a new one.',
  range: '1–9 kg',
  sourceLabel: 'Moss, estimate',
  year: undefined,
};

function XpDemo() {
  const [xp, setXp] = useState(425);
  const [earned, setEarned] = useState(0);
  return (
    <div className="grid w-full max-w-md gap-3">
      <XPBar level={5} xp={xp} xpForNext={600} justEarned={earned} />
      <div className="flex flex-wrap gap-3">
        <Button
          size="sm"
          variant="neutral"
          onClick={() => {
            setEarned(30);
            setXp((value) => Math.min(value + 30, 600));
          }}
        >
          Earn 30 XP
        </Button>
        <Button
          size="sm"
          variant="ghost"
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

function RingDemo() {
  const [logs, setLogs] = useState(2);
  return (
    <div className="flex flex-wrap items-end gap-6">
      <Spec name="48">
        <RingProgress value={1} max={3} size={48} label="Today's ring">
          <span className="text-[0.6875rem]">1/3</span>
        </RingProgress>
      </Spec>
      <Spec name="64 · press the button">
        <RingProgress value={logs} max={3} label="Today's ring">
          {logs}/3
        </RingProgress>
      </Spec>
      <Spec name="96 · blue">
        <RingProgress value={7} max={10} size={96} tone="blue" label="Quiz progress">
          <span className="type-figure text-display-sm text-ink">7</span>
        </RingProgress>
      </Spec>
      <Spec name="160 · timer">
        <RingProgress
          value={12}
          max={20}
          size={160}
          tone="yellow"
          label="Break"
          valueText="Back at 14:52"
          keepChildren
        >
          <span className="grid gap-1.5">
            <span className="type-slug text-ink-3">Back at</span>
            <span className="type-figure text-display-md text-ink">14:52</span>
          </span>
        </RingProgress>
      </Spec>
      <Spec name="complete">
        <RingProgress value={3} max={3} label="Today's ring" />
      </Spec>
      <Button
        size="sm"
        variant="neutral"
        onClick={() => setLogs((value) => (value >= 3 ? 0 : value + 1))}
      >
        {logs >= 3 ? 'Start over' : 'Log one'}
      </Button>
    </div>
  );
}

function TickerDemo() {
  const [value, setValue] = useState(1284);
  return (
    <div className="flex flex-wrap items-center gap-6">
      <span className="type-figure text-display-lg">
        <NumberTicker value={value} />
      </span>
      <span className="font-mono text-data-lg">
        <Approx weight="mono" />
        <NumberTicker value={value / 100} format={(amount) => formatCo2Parts(amount).value} />
        &nbsp;kg
      </span>
      <Button size="sm" variant="neutral" onClick={() => setValue((current) => current + 37)}>
        Add 37
      </Button>
      <Button
        size="sm"
        variant="ghost"
        onClick={() => setValue((current) => Math.max(0, current - 296))}
      >
        Take 296
      </Button>
    </div>
  );
}

function LedgerDemo() {
  const [selected, setSelected] = useState<string | null>('veg');
  return (
    <div className="grid w-full grid-cols-1 gap-5 lg:grid-cols-2">
      <Ledger aria-label="Logged today">
        <ListRow
          leading={<Sticker category="move" size={32} rotate={-3} />}
          title="Cycled instead of driving"
          meta="08:42 · 5 km · swap"
          value={
            <>
              <Approx weight="mono" />
              0.86 kg
            </>
          }
          trailing={
            <IconButton label="Undo: cycled instead of driving" icon={RotateCcw} size="sm" />
          }
        />
        <ListRow
          leading={<Sticker category="eat" size={32} rotate={2} />}
          title="Veggie meal"
          meta="12:30 · 1 meal"
          value={
            <>
              <Approx weight="mono" />
              1.1 kg
            </>
          }
          selected={selected === 'veg'}
          onClick={() => setSelected((current) => (current === 'veg' ? null : 'veg'))}
          trailing={<IconButton label="Delete: veggie meal" icon={Trash2} size="sm" />}
        />
        <ListRow
          leading={
            <IconTile hue="blue">
              <Droplet size={20} strokeWidth={2.25} />
            </IconTile>
          }
          title="Short shower"
          meta="07:10 · 4 min"
          value={<Tag>+12 XP</Tag>}
        />
      </Ledger>
      <Ledger aria-label="Settings">
        <ListRow
          leading={
            <IconTile hue="yellow">
              <Settings size={20} strokeWidth={2.25} />
            </IconTile>
          }
          title="Region"
          description="World average"
          href="#inputs"
          trailing={<ChevronRight size={20} strokeWidth={2.25} aria-hidden="true" />}
        />
        <ListRow
          title="Graphics"
          description="Auto picks for your device."
          value="Auto"
          onClick={() => undefined}
        />
        <ListRow title="Version" meta="2.0.0 · local mode" />
      </Ledger>
    </div>
  );
}

export function DataSection({ index }: { index: number }) {
  return (
    <Section
      id="data"
      index={index}
      title="Data display"
      note="A figure you are proud of is Tilt Warp · a figure you read is Martian Mono · estimates wear the ≈"
    >
      <Demo
        label="HonestyMark"
        note="The ≈ is a button: it opens the formula, the comparison and the source (a bottom sheet below md). Figures here are illustrative."
      >
        <p className="flex items-center gap-2 font-mono text-data-lg">
          <HonestyMark source={SAMPLE_SOURCE} />
          0.86 kg <Co2e explain />
        </p>
        <p className="flex items-center gap-2 font-mono text-data-lg">
          <HonestyMark source={AI_SOURCE} size="sm" />
          <span className="underline decoration-dotted decoration-2 underline-offset-4">4 kg</span>
        </p>
      </Demo>

      <Demo
        label="StatReadout"
        note="One hero readout per view. Deltas are ink with an arrow, never red or green type."
        className="gap-x-12"
      >
        <StatReadout
          label="Avoided this week"
          value={12.4}
          format={(value) => formatCo2Parts(value).value}
          unit={
            <>
              kg <Co2e />
            </>
          }
          source={SAMPLE_SOURCE}
          delta={{ dir: 'up', text: '2.1 kg more than last week' }}
          size="hero"
        />
        <StatReadout
          label="Streak"
          value={12}
          unit="days"
          delta={{ dir: 'flat', text: 'best: 12' }}
          size="lg"
        />
        <StatReadout label="Avoided today" value="2.4" unit="kg" approx />
        <StatReadout label="Custom action" value="4" unit="kg" source={AI_SOURCE} />
        <StatReadout
          label="Petting the cat"
          value={0}
          source={{ ...SAMPLE_SOURCE, kind: 'none' }}
        />
      </Demo>

      <Demo
        label="Grouped in a Ticket"
        note="Readouts share one ticket with dashed dividers; never a row of separate coloured cards."
      >
        <Ticket label="This week" className="w-full max-w-2xl">
          <Ticket.Stub
            label="Avoided"
            value={
              <>
                <Approx />
                12.4
              </>
            }
            unit="kg"
          />
          <Ticket.Stub label="Actions" value="17" />
          <Ticket.Stub label="Rings" value="5" unit="of 7" />
          <Ticket.Stub label="Best day" value="Tue" />
        </Ticket>
      </Demo>

      <Demo
        label="Meter"
        note="Moves by transform only. Solid = measured, hatch = projected."
        className="grid gap-5 md:grid-cols-2 xl:grid-cols-3"
      >
        <div className="grid gap-2">
          <Meter value={62} max={100} label="Mature tree progress" valueText="62 percent" />
          <p className="type-slug text-ink-3">md · green</p>
        </div>
        <div className="grid gap-2">
          <Meter value={30} max={100} projected={72} tone="blue" label="Pace this year" />
          <p className="type-slug text-ink-3">projected (hatch)</p>
        </div>
        <div className="grid gap-2">
          <Meter value={8} max={10} size="lg" tone="yellow" label="Daily cap" />
          <p className="type-slug text-ink-3">lg · yellow</p>
        </div>
        <div className="grid gap-2">
          <Meter value={4} max={12} size="sm" tone="move" label="Fix-it Fortnight" />
          <p className="type-slug text-ink-3">sm · category tone</p>
        </div>
        <div className="flex items-center gap-3">
          <Meter pips value={2} max={3} label="Quest progress" />
          <span className="font-mono text-data-sm">2 / 3</span>
          <Meter pips value={5} max={7} tone="eat" label="Week progress" />
          <span className="font-mono text-data-sm">5 / 7</span>
        </div>
      </Demo>

      <Demo label="XPBar" note="XP just earned is drawn yellow for 600 ms, then turns green.">
        <XpDemo />
        <Card
          tone="paper"
          padded={false}
          className="flex h-11 items-center gap-2 px-3 shadow-none md:border-3"
        >
          <span className="type-slug text-ink-3">LV</span>
          <span className="type-figure text-display-xs">5</span>
          <XPBar compact level={5} xp={425} xpForNext={600} />
        </Card>
      </Demo>

      <Demo label="RingProgress">
        <RingDemo />
      </Demo>

      <Demo
        label="NumberTicker"
        note="An odometer: digits roll with the mechanical easing, 18 ms stagger from the right. Reduced motion: it swaps."
      >
        <TickerDemo />
      </Demo>

      <Demo
        label="Ledger and ListRow"
        note="One card, hairline rules. Undo and delete are always a visible button."
      >
        <LedgerDemo />
      </Demo>
    </Section>
  );
}
