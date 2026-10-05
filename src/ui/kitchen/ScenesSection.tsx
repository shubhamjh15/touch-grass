'use client';

import { Compass, Flame, Timer } from 'lucide-react';
import { useState, type CSSProperties, type ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { Approx } from '../Approx';
import { Avatar } from '../Avatar';
import { Button } from '../Button';
import { Chip } from '../Chip';
import { CloudGlyph } from '../glyphs';
import { SectionHeading } from '../headings';
import { Lettering } from '../Lettering';
import { Prose } from '../misc';
import { Panel } from '../Panel';
import { Receipt } from '../Receipt';
import { Stamp } from '../Stamp';
import { Sticker } from '../Sticker';
import { StickerPill } from '../StickerPill';
import { Tag } from '../Tag';
import { TapeNote } from '../TapeNote';
import { TearStub } from '../TearStub';
import { Ticket } from '../Ticket';
import { XPBar } from '../XPBar';
import { Demo, Section, SkyPlate, type SkyTime } from './parts';

const TIMES: SkyTime[] = ['dawn', 'day', 'dusk', 'night'];

function SkyScene({ time }: { time: SkyTime }) {
  return (
    <SkyPlate time={time} className="h-72">
      <CloudGlyph size={84} className="absolute top-14 left-[14%]" />
      <span
        aria-hidden="true"
        className="absolute top-16 left-[58%] size-12 rounded-full border-4 border-ink shadow-2"
        style={{ background: 'var(--orb)' } as CSSProperties}
      />
      <div className="absolute top-3 left-3">
        <Tag hue="white">{time}</Tag>
      </div>
      <div className="absolute top-3 right-3 flex items-center gap-2">
        <StickerPill hue="yellow" icon={Flame} margin={3}>
          <span className="type-figure text-[1.125rem]">12</span>
        </StickerPill>
      </div>
      <div className="absolute bottom-5 left-4">
        <Tag variant="specimen" title="Fern" meta="Oak · day 12" />
      </div>
      <div className="absolute right-4 bottom-4 flex flex-col items-end gap-2.5">
        <Button size="sm" variant="neutral" icon={Compass}>
          Explore
        </Button>
        <Button size="sm" variant="reward" icon={Timer}>
          Touch grass
        </Button>
      </div>
    </SkyPlate>
  );
}

export function ScenesSection({ index }: { index: number }) {
  return (
    <Section
      id="scenes"
      index={index}
      title="On the real backgrounds"
      note="Mat, paper and sky · nothing is printed on the sky: everything over it brings its own backing"
    >
      <Demo
        label="On the sky, at four times of day"
        note="The focus ring keeps its ink keyline, so it also works on the night sky. Tab into the buttons."
        className="grid gap-5 md:grid-cols-2"
      >
        {TIMES.map((time) => (
          <SkyScene key={time} time={time} />
        ))}
      </Demo>

      <Demo
        label="On the mat: a slice of Today"
        note="The reference composition from the mockups, built only from kit parts."
      >
        <div className="w-full max-w-[540px] overflow-hidden rounded-lg border-4 border-ink shadow-3">
          <SkyPlate className="h-40 rounded-none border-0 shadow-none">
            <CloudGlyph size={80} className="absolute top-6 left-[38%]" />
            <div className="absolute top-4 right-4 flex items-center gap-2.5">
              <Avatar kind="tree" size={42} badge={5} label="Fern, level 5" />
              <Avatar kind="moss" label="Moss" />
            </div>
            <div className="absolute bottom-6 left-4">
              <Tag variant="specimen" title="Fern" meta="Oak · day 12" />
            </div>
          </SkyPlate>
          <Panel variant="mat" edge="pinked-t" className="px-4 pt-5 pb-6">
            <p className="type-slug text-ink-3">Tuesday 06 October</p>
            <p className="mt-2 text-h1">Afternoon, Sam.</p>
            <Ticket label="Level, streak and today" className="mt-4">
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
            <SectionHeading title="Stick one on" action={{ label: 'All 42', href: '#stickers' }} />
            <div className="scroll-row gap-3">
              <Sticker category="move" label="Bike it" onClick={() => undefined} />
              <Sticker category="eat" label="Veggie meal" onClick={() => undefined} />
              <Sticker category="power" label="Cold wash" onClick={() => undefined} />
              <Sticker category="water" label="Short shower" onClick={() => undefined} />
              <Sticker category="stuff" label="Thrifted" onClick={() => undefined} />
              <Sticker category="waste" label="Refilled" onClick={() => undefined} />
            </div>
            <SectionHeading title="Today's quests" meta="Resets in 9 h 28 m" />
            <div className="grid gap-3">
              <TearStub
                title="Vampire Slayer"
                category="power"
                progress={{ value: 3, max: 3 }}
                reward="+50 XP"
                state="claimable"
                featured
              />
              <TearStub
                title="Two-Wheel Tuesday"
                category="move"
                progress={{ value: 1, max: 2 }}
                reward="+60 XP"
                state="active"
              />
            </div>
            <TapeNote author="Moss says:" className="mx-2 mt-8">
              your bike rides did the heavy lifting this week. One more and Fern grows a new ring.
            </TapeNote>
          </Panel>
        </div>
      </Demo>

      <Demo
        label="On paper"
        note="Printed matter sits on the warm paper tone: stamps, receipts, tags."
      >
        <Panel variant="paper" className="flex w-full max-w-2xl flex-wrap items-center gap-8 p-6">
          <Stamp label="Touched grass" date="06 Oct 2026" />
          <Stamp label="Claimed" hue="green" rotate={4} />
          <div className="flex flex-wrap gap-1.5">
            <Tag hue="blue">Daily</Tag>
            <Tag>+50 XP</Tag>
            <Tag category="nature" />
          </div>
          <div className="flex gap-2">
            <Chip selected onSelectedChange={() => undefined}>
              All
            </Chip>
            <Chip onSelectedChange={() => undefined}>Daily</Chip>
          </div>
          <Receipt
            className="w-56 [--edge-fill:var(--color-paper)]"
            title="Week 41"
            rows={[
              { label: 'Actions', value: '17' },
              { label: 'Rings', value: '5 / 7' },
            ]}
          />
        </Panel>
      </Demo>
    </Section>
  );
}

function Replay({ label, children }: { label: string; children: (key: number) => ReactNode }) {
  const [run, setRun] = useState(0);
  return (
    <figure className="flex w-[220px] flex-col items-center gap-3">
      <div className="grid h-32 w-full place-items-center rounded-md border-2 border-dashed border-ink-4">
        {children(run)}
      </div>
      <Button size="sm" variant="neutral" onClick={() => setRun((value) => value + 1)}>
        {label}
      </Button>
    </figure>
  );
}

export function MotionSection({ index }: { index: number }) {
  const [peeled, setPeeled] = useState(false);
  return (
    <Section
      id="motion"
      index={index}
      title="Motion"
      note="Paper verbs only: peel, carry, press, stamp, tear, print · nothing merely fades"
    >
      <Demo
        label="Keyframes"
        note="Each plays once. Under reduced motion they resolve to their end state."
      >
        <Replay label="Stick">
          {(run) => (
            <div
              key={run}
              className="animate-stick rounded-md border-3 border-ink bg-card px-4 py-3 text-label shadow-3"
            >
              Stuck on
            </div>
          )}
        </Replay>
        <figure className="flex w-[220px] flex-col items-center gap-3">
          <div className="grid h-32 w-full place-items-center rounded-md border-2 border-dashed border-ink-4">
            <div
              className={cn(
                'rounded-md border-3 border-ink bg-card px-4 py-3 text-label shadow-3',
                peeled && 'animate-peel',
              )}
            >
              Peel me off
            </div>
          </div>
          <Button size="sm" variant="neutral" onClick={() => setPeeled((value) => !value)}>
            {peeled ? 'Put it back' : 'Peel'}
          </Button>
        </figure>
        <Replay label="Stamp">
          {(run) => <Stamp key={run} label="Planted" date="06 Oct 2026" hue="green" animate />}
        </Replay>
        <Replay label="Sweep">
          {(run) => (
            <Lettering key={run} fill="yellow" sweep className="text-display-lg">
              Level 6
            </Lettering>
          )}
        </Replay>
        <Replay label="Pop">
          {(run) => (
            <span
              key={run}
              className="grid size-12 animate-pop place-items-center rounded-full border-3 border-ink bg-yellow type-figure text-display-xs"
            >
              7
            </span>
          )}
        </Replay>
      </Demo>

      <Demo
        label="Tokens"
        className="grid gap-x-10 gap-y-3 font-mono text-data sm:grid-cols-2 lg:grid-cols-3"
      >
        {[
          ['--dur-press', '80 ms · press, release'],
          ['--dur-fast', '140 ms · hover, toggles, peel'],
          ['--dur-base', '220 ms · small enters, stick'],
          ['--dur-slow', '360 ms · sheets, meters'],
          ['--dur-scene', '640 ms · route change'],
          ['--dur-ceremony', '1200 ms · the log moment'],
          ['ease-out', 'arrivals'],
          ['ease-in', 'exits, the stamp'],
          ['ease-stick', 'CSS overshoot: stuck'],
          ['ease-peel', 'lift-offs'],
          ['ease-mech', 'numbers, meters, toggles'],
          ['SPRINGS', 'press · pop · settle · sheet · float · carry · tick'],
        ].map(([token, use]) => (
          <p key={token} className="flex flex-wrap gap-x-2">
            <span className="font-semibold">{token}</span>
            <span className="text-ink-3">{use}</span>
          </p>
        ))}
      </Demo>
    </Section>
  );
}

export function ProseSection({ index }: { index: number }) {
  return (
    <Section
      id="prose"
      index={index}
      title="Prose"
      note="Lessons, methodology, privacy and the coach's markdown · measure 680 px · never on the bare mat"
    >
      <Demo
        label="prose prose-eco"
        className="grid gap-5 xl:grid-cols-[minmax(0,680px)_minmax(0,1fr)]"
      >
        <div className="rounded-lg border-4 border-ink bg-card p-5 shadow-3 md:p-8">
          <Prose>
            <h2>Why short trips matter</h2>
            <p>
              A cold engine burns more fuel per kilometre, so the trips a bike replaces most easily
              are also the ones a car is <strong>worst</strong> at. That is why a 5 km ride is worth
              more than it looks. See the <a href="#data">methodology</a> for the factor we use,{' '}
              <code>MOVE-02</code>.
            </p>
            <blockquote>
              <p>
                Estimates are estimates. We show the range, the comparison and the source every
                time.
              </p>
            </blockquote>
            <h3>What counts</h3>
            <ul>
              <li>Trips you would otherwise have driven alone.</li>
              <li>
                Rides logged with a distance, <mark>not a guess</mark>.
              </li>
            </ul>
            <ol>
              <li>Pick the action.</li>
              <li>Set the distance.</li>
              <li>
                Press <kbd>Enter</kbd> to stick it on.
              </li>
            </ol>
            <table>
              <thead>
                <tr>
                  <th>Mode</th>
                  <th>kg per km</th>
                  <th>Sample</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Petrol car, alone</td>
                  <td>0.171</td>
                  <td>illustrative</td>
                </tr>
                <tr>
                  <td>Bicycle</td>
                  <td>0</td>
                  <td>illustrative</td>
                </tr>
              </tbody>
            </table>
            <hr />
            <p>
              Figures in this specimen are illustrative. Real ones come from the evidence table.
            </p>
          </Prose>
        </div>
        <div className="max-w-md self-start rounded-md rounded-tl-paper border-2 border-ink bg-card p-3">
          <p className="mb-1.5 type-slug text-ink-3">Moss · 14:33 · prose-compact</p>
          <Prose compact>
            <p>
              Probably your commute. Two ideas, <strong>smallest first</strong>:
            </p>
            <ul>
              <li>Ride on dry days.</li>
              <li>Share the school run once a week. 🚲</li>
            </ul>
          </Prose>
        </div>
      </Demo>
    </Section>
  );
}
