'use client';

import { ChartColumn, Flame, Plus, Target } from 'lucide-react';
import { Button } from '../Button';
import { Callout } from '../Callout';
import { Card } from '../Card';
import { MossFace } from '../glyphs';
import { Marquee, SectionHeading } from '../headings';
import { Lettering } from '../Lettering';
import { Stamp } from '../Stamp';
import { EmptyState, ErrorState, OfflineBanner, Skeleton } from '../states';
import { TiltCard } from '../TiltCard';
import { Demo, Section, SkyPlate } from './parts';

export function StatesSection({ index }: { index: number }) {
  return (
    <Section
      id="states"
      index={index}
      title="States"
      note="Empty, loading, error and offline are designed, never an afterthought · no blame, no 'oops'"
    >
      <Demo label="EmptyState" className="grid gap-5 md:grid-cols-2">
        <EmptyState
          slug="Nothing stuck yet"
          slot={1}
          category="move"
          title="Nothing stuck yet today."
          body="Your first action is one tap away."
          action={
            <Button variant="primary" icon={Plus}>
              Log an action
            </Button>
          }
        />
        <EmptyState
          slug="No data yet"
          category="power"
          title="Log one action and this page wakes up."
          illustration={<MossFace size={64} mood="sleepy" />}
        />
      </Demo>

      <Demo
        label="Skeleton"
        note="Hatched, stepping between two opacities. Only for lazy chunks and the coach."
        className="grid gap-5 md:grid-cols-3"
      >
        <Card aria-busy="true">
          <Skeleton shape="text" lines={4} />
        </Card>
        <Card aria-busy="true" padded={false}>
          <Skeleton shape="row" />
          <Skeleton shape="row" className="border-t-[1.5px] border-ink" />
        </Card>
        <div className="flex items-center gap-4" aria-busy="true">
          <Skeleton shape="sticker" />
          <Skeleton shape="block" className="h-[66px] flex-1" />
        </div>
      </Demo>

      <Demo label="ErrorState">
        <ErrorState
          className="w-full max-w-xl"
          body="This page hit a snag while drawing your week."
          onRetry={() => undefined}
          onExport={() => undefined}
          details={'TypeError: week is undefined\n  at ImpactPage (impact.tsx:42)'}
        />
      </Demo>

      <Demo
        label="OfflineBanner"
        note="Not an error. A calm yellow pill; it renders nothing while online."
      >
        <OfflineBanner offline />
      </Demo>
    </Section>
  );
}

export function HeadingsSection({ index }: { index: number }) {
  return (
    <Section
      id="headings"
      index={index}
      title="Headings, depth, callouts"
      note="Sticker lettering for a handful of proud words · leader lines never cross"
    >
      <Demo label="SectionHeading" className="grid gap-2">
        <div className="w-full max-w-xl">
          <SectionHeading
            title="Stick one on"
            action={{ label: 'All 42 actions', href: '#stickers' }}
            className="mt-0"
          />
          <SectionHeading title="Today's quests" meta="Resets in 9 h 28 m" />
        </div>
      </Demo>

      <Demo
        label="Marquee: title"
        note="The die-cut page title. On this page it is shown as a specimen; a route has exactly one h1."
      >
        <div className="w-full rounded-lg border-2 border-dashed border-ink-4 p-5">
          <div className="grid gap-4" aria-hidden="true">
            <p className="type-slug text-ink-3">Tuesday 06 October</p>
            <p className="text-display-lg">
              <Lettering fill="ink">Quests</Lettering>
            </p>
            <p className="max-w-[60ch] text-lead text-ink-2">
              Three a day, three a week, and a few long ones.
            </p>
          </div>
        </div>
      </Demo>

      <Demo
        label="Marquee: ticker"
        note="Landing only. Steps along at 12 fps; pauses on hover and focus; still under reduced motion."
      >
        <Marquee
          variant="ticker"
          title="Peel, stick, stamp, tear"
          items={['Peel', 'Stick', 'Stamp', 'Tear', 'Grow']}
          className="w-full rounded-sm"
        />
      </Demo>

      <Demo
        label="Lettering"
        note="Tilt Warp on its own tilt axes, with ink outline, white die-cut margin and a hard shadow. Hover the first one."
        className="items-center gap-x-10 gap-y-8 py-3"
      >
        <Lettering fill="green" hoverTilt className="text-display-xl">
          Fix this.
        </Lettering>
        <Lettering fill="yellow" className="text-display-lg">
          Level 6
        </Lettering>
        <Lettering fill="pink" className="text-display-lg">
          Planted
        </Lettering>
        <Lettering fill="blue" className="text-display-md">
          Sapling
        </Lettering>
        <Lettering fill="white" tilt="none" className="text-display-md">
          12
        </Lettering>
        <Lettering fill="ink" className="text-display-md">
          Grove
        </Lettering>
      </Demo>

      <Demo
        label="Highlighter slab"
        note="The only emphasis allowed inside a headline. Never coloured type."
      >
        <p className="text-h1">
          Grow a <span className="highlighter">living tree</span> by shrinking your footprint.
        </p>
      </Demo>

      <Demo
        label="TiltCard"
        note="Up to 4° toward a fine pointer; off on touch and under reduced motion. One per viewport."
      >
        <TiltCard className="w-full max-w-sm">
          <Card tone="paper" featured plate="green">
            <p className="type-slug text-ink-3">Tree passport · Nº 0012</p>
            <p className="mt-2 type-figure text-display-md">Fern</p>
            <p className="mt-1 type-slug text-ink-2">Oak · young tree · day 12</p>
            <div className="mt-4 flex justify-end">
              <Stamp label="Planted" date="24 Sep 2026" hue="green" rotate={-5} />
            </div>
          </Card>
        </TiltCard>
      </Demo>

      <Demo
        label="Callout"
        note="A chip tied to a point by a straight ink line ending in a dot. Real links, in a sensible tab order."
      >
        <SkyPlate className="h-64 w-full max-w-3xl">
          <div className="absolute top-8 left-4 md:left-6">
            <Callout
              side="left"
              icon={Target}
              hue="yellow"
              label="Quests"
              meta="1/3"
              href="#surfaces"
              leader={{ dx: 120, dy: 46 }}
            />
          </div>
          <div className="absolute top-36 left-4 md:left-6">
            <Callout
              side="left"
              icon={ChartColumn}
              hue="blue"
              label="Impact"
              meta="12 rings"
              href="#data"
              occluded
              leader={{ dx: 150, dy: -10 }}
            />
          </div>
          <div className="absolute top-12 right-4 md:right-6">
            <Callout
              side="right"
              icon={<MossFace bare size={24} />}
              hue="green"
              label="Ask Moss"
              onClick={() => undefined}
              leader={{ dx: -90, dy: 56 }}
            />
          </div>
          <div className="absolute right-4 bottom-8 md:right-6">
            <Callout
              side="right"
              icon={Flame}
              hue="white"
              label="Streak"
              meta="12 days"
              leader={{ dx: -70, dy: -24 }}
            />
          </div>
        </SkyPlate>
      </Demo>
    </Section>
  );
}
