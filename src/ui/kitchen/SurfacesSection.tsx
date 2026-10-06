'use client';

import { ArrowRight, BookOpen, ChartColumn, Timer } from 'lucide-react';
import { useState } from 'react';
import { BRAND } from '@/lib/brand';
import { formatCo2Parts } from '@/lib/format';
import { Approx } from '../Approx';
import { Button } from '../Button';
import { Card } from '../Card';
import { Co2e } from '../Co2e';
import { IconTile } from '../Ledger';
import { NumberTicker } from '../NumberTicker';
import { Panel } from '../Panel';
import { Receipt } from '../Receipt';
import { Tag } from '../Tag';
import { TapeNote } from '../TapeNote';
import { TearStub, type TearStubState } from '../TearStub';
import { Ticket } from '../Ticket';
import { XPBar } from '../XPBar';
import { Demo, Section } from './parts';

function ClaimDemo() {
  const [state, setState] = useState<TearStubState>('claimable');
  return (
    <div className="grid w-full max-w-xl gap-3">
      <TearStub
        title="Vampire Slayer"
        description="Switch off three standby devices."
        category="power"
        kind="daily"
        progress={{ value: 3, max: 3 }}
        reward="+50 XP"
        state={state}
        featured
        onClaim={() => setState('claimed')}
      />
      {state === 'claimed' ? (
        <Button
          variant="ghost"
          size="sm"
          className="justify-self-start"
          onClick={() => setState('claimable')}
        >
          Print a fresh stub
        </Button>
      ) : (
        <p className="text-caption text-ink-3">
          Tear it: click, press Enter or Space on the stub, or drag it to the right.
        </p>
      )}
    </div>
  );
}

function LiveTicket() {
  const [logs, setLogs] = useState(3);
  const kg = formatCo2Parts(logs * 0.8);
  return (
    <div className="grid w-full max-w-xl gap-3">
      <Ticket label="Today at a glance">
        <Ticket.Stub
          label="Avoided today"
          value={
            <>
              <Approx />
              <NumberTicker value={logs * 0.8} format={(value) => formatCo2Parts(value).value} />
            </>
          }
          unit={
            <>
              {kg.unit} <Co2e explain />
            </>
          }
          flex={1.45}
        />
        <Ticket.Stub label="Logged" value={<NumberTicker value={logs} />} />
        <Ticket.Stub label="Quests" value="1" unit="of 3" />
      </Ticket>
      <Button
        variant="neutral"
        size="sm"
        className="justify-self-start"
        onClick={() => setLogs((value) => value + 1)}
      >
        Log one more
      </Button>
    </div>
  );
}

export function SurfacesSection({ index }: { index: number }) {
  return (
    <Section
      id="surfaces"
      index={index}
      title="Surfaces and printed matter"
      note="White cards on the mat · paper for print · one craft artefact per component"
    >
      <Demo label="Card" className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        <Card>
          <Card.Header slug="Fig. 01" title="A plain card" action={<Tag hue="blue">Daily</Tag>} />
          <Card.Body>
            <p className="text-body-sm text-ink-2">
              3 px ink below md, 4 px and a 16 px radius from md up. Static cards never lift on
              hover.
            </p>
          </Card.Body>
          <Card.Footer>Source: the design bible, 4.2</Card.Footer>
        </Card>
        <Card featured plate="pink">
          <Card.Header slug="Featured" title="One hero per viewport" />
          <Card.Body>
            <p className="text-body-sm text-ink-2">
              The second colour plate under the shadow marks the one thing to do next.
            </p>
          </Card.Body>
        </Card>
        <Card interactive onClick={() => undefined} className="flex items-center gap-3">
          <IconTile hue="blue">
            <BookOpen size={20} strokeWidth={2.25} />
          </IconTile>
          <span className="min-w-0 flex-1">
            <span className="block text-label">An interactive card</span>
            <span className="block text-caption text-ink-3">The whole card is one button.</span>
          </span>
          <ArrowRight size={20} strokeWidth={2.25} aria-hidden="true" />
        </Card>
        <Card tone="paper">
          <p className="type-slug text-ink-3">tone = paper</p>
          <p className="mt-2 text-body-sm text-ink-2">
            Printed matter: receipts, passport pages, stubs.
          </p>
        </Card>
        <Card tone="yellow">
          <p className="type-slug text-ink-3">tone = yellow</p>
          <p className="mt-2 text-body-sm text-ink-2">
            A hue always means its tint, so this text still passes.
          </p>
        </Card>
        <Card href="#data" className="flex items-center gap-3">
          <IconTile hue="green">
            <ChartColumn size={20} strokeWidth={2.25} />
          </IconTile>
          <span className="min-w-0 flex-1 text-label">A card that is a link</span>
          <ArrowRight size={20} strokeWidth={2.25} aria-hidden="true" />
        </Card>
        <Card interactive disabled className="flex items-center gap-3">
          <IconTile hue="yellow">
            <Timer size={20} strokeWidth={2.25} />
          </IconTile>
          <span className="min-w-0 flex-1 text-label">A disabled card</span>
        </Card>
        <div className="stack relative isolate rounded-md border-3 border-ink bg-card p-4">
          <p className="type-slug text-ink-3">stack</p>
          <p className="mt-2 text-body-sm text-ink-2">
            Up to two more sheets peek out: a deck of quests or lessons.
          </p>
        </div>
      </Demo>

      <Demo label="Panel" className="grid gap-5 md:grid-cols-2">
        <Panel variant="graph">
          <p className="type-slug text-ink-3">graph</p>
          <p className="mt-2 text-body-sm">A framed piece of the cutting mat inside a page.</p>
        </Panel>
        <Panel variant="well">
          <p className="type-slug text-ink-3">well</p>
          <p className="mt-2 text-body-sm">A sunk area: debossed, filled with mat-deep.</p>
        </Panel>
        <Panel variant="paper">
          <p className="type-slug text-ink-3">paper</p>
          <p className="mt-2 text-body-sm">Printed matter with the 4 px paper radius.</p>
        </Panel>
        <div className="overflow-hidden rounded-lg border-3 border-ink bg-(--sky-day-1)">
          <div className="h-14" />
          <Panel variant="mat" edge="pinked-t" className="p-4">
            <p className="type-slug text-ink-3">mat + pinked-t</p>
            <p className="mt-2 text-body-sm">
              The desk. The only thing that may scroll over a stage.
            </p>
          </Panel>
        </div>
      </Demo>

      <Demo
        label="Ticket"
        note="Perforated stubs with half-moon notches; one proud figure per stub. Press the button to watch the figures roll."
      >
        <LiveTicket />
        <Ticket label="Level, streak and today" className="w-full max-w-xl">
          <Ticket.Stub label="Level" meta="425/600" value="5" flex={1.45}>
            <XPBar level={5} xp={425} xpForNext={600} hideLevel hideCount />
          </Ticket.Stub>
          <Ticket.Stub label="Streak" value="12" unit="days" />
          <Ticket.Stub
            label="Today"
            value={
              <>
                <Approx />
                2.4
              </>
            }
            unit="kg"
          />
        </Ticket>
      </Demo>

      <Demo
        label="TearStub"
        note="The quest row. Its reward is a stub you tear off; the stub is a real button."
      >
        <ClaimDemo />
        <div className="grid w-full max-w-xl gap-3">
          <TearStub
            title="Two-Wheel Tuesday"
            description="Cycle instead of driving, twice."
            category="move"
            kind="daily"
            progress={{ value: 1, max: 2 }}
            reward="+60 XP"
            state="active"
            timeLeft="9 h left"
          />
          <TearStub
            title="Meatless Day"
            category="eat"
            kind="weekly"
            progress={{ value: 3, max: 3 }}
            reward="+100 XP"
            state="claimed"
          />
          <TearStub
            title="Fix-it Fortnight"
            description="Repair one thing instead of replacing it."
            category="stuff"
            kind="epic"
            progress={{ value: 4, max: 12 }}
            reward="+250 XP"
            state="active"
          />
          <TearStub
            title="Cold Snap"
            description="Wash a load at 30 °C."
            category="power"
            kind="daily"
            progress={{ value: 0, max: 1 }}
            reward="+40 XP"
            state="expired"
          />
        </div>
      </Demo>

      <Demo
        label="TapeNote"
        note="Rotated notes hold at most three lines."
        className="gap-x-10 gap-y-10 pt-3"
      >
        <TapeNote author="Moss says:" className="max-w-sm">
          your bike rides did the heavy lifting this week. One more and Fern grows a new ring.
        </TapeNote>
        <TapeNote tone="paper" tape="yellow" rotate={1} className="max-w-xs">
          A rain day keeps your streak. You have two left this week.
        </TapeNote>
        <TapeNote tone="blue" tape="green" rotate={0} className="max-w-xs">
          Offline. Moss&rsquo;s built-in notes, not AI.
        </TapeNote>
        <TapeNote tone="pink" tape="blue" rotate={-2} className="max-w-xs">
          Couldn&rsquo;t reach Moss. Your message is still in the box.
        </TapeNote>
      </Demo>

      <Demo
        label="Receipt"
        note="Totals. Every kg value starts with the drawn ≈ (illustrative figures)."
        className="gap-x-10"
      >
        <Receipt
          className="w-64"
          title={`${BRAND.name} · Today`}
          meta="Tue 06 Oct 2026 · 14:32"
          rows={[
            {
              label: 'Bike 5 km',
              value: (
                <>
                  <Approx weight="mono" />
                  1.02 kg
                </>
              ),
            },
            {
              label: 'Veggie meal',
              value: (
                <>
                  <Approx weight="mono" />
                  1.10 kg
                </>
              ),
            },
            {
              label: 'Cold wash',
              value: (
                <>
                  <Approx weight="mono" />
                  0.28 kg
                </>
              ),
            },
          ]}
          total={{
            label: 'CO2e avoided',
            value: (
              <>
                <Approx weight="mono" />
                2.40 kg
              </>
            ),
          }}
        />
      </Demo>
    </Section>
  );
}
