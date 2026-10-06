'use client';

import { cn } from '@/lib/cn';
import { Card } from '../Card';
import { Chapter, Demo } from './parts';

const SURFACES = [
  { name: 'Mint', role: 'The page', className: 'bg-mat' },
  { name: 'White', role: 'Cards', className: 'bg-card' },
  { name: 'Ink', role: 'Text and borders', className: 'bg-ink' },
  { name: 'Deep mint', role: 'Wells, hover', className: 'bg-mat-deep' },
] as const;

const HUES = [
  { name: 'Green', role: 'The one primary button', fill: 'bg-green', tint: 'bg-green-tint' },
  { name: 'Yellow', role: 'Rewards, focus', fill: 'bg-yellow', tint: 'bg-yellow-tint' },
  { name: 'Blue', role: 'Links, information', fill: 'bg-blue', tint: 'bg-blue-tint' },
  { name: 'Pink', role: 'A playful accent', fill: 'bg-pink', tint: 'bg-pink-tint' },
] as const;

const TYPE = [
  { name: 'Display', spec: '44 / 48, 32 / 36 on phones', className: 'text-display-xl' },
  { name: 'H1', spec: '28 / 34', className: 'text-h1' },
  { name: 'H2', spec: '20 / 28', className: 'text-h2' },
  { name: 'Body', spec: '16 / 24', className: 'text-body' },
  { name: 'Small', spec: '14 / 20', className: 'text-body-sm' },
] as const;

const SPACE = [
  { name: 'Between sections', spec: '40 px, 56 px from tablet', className: 'h-10 md:h-14' },
  { name: 'Inside a card', spec: '20 px, 24 px from tablet', className: 'h-5 md:h-6' },
  { name: 'Between related things', spec: '16 px', className: 'h-4' },
] as const;

function Swatch({ name, role, className }: { name: string; role: string; className: string }) {
  return (
    <div className="w-36">
      <div className={cn('h-16 rounded-lg border-2 border-ink', className)} />
      <p className="mt-2 text-body-sm font-semibold">{name}</p>
      <p className="text-body-sm text-ink-3">{role}</p>
    </div>
  );
}

export function FoundationsChapter() {
  return (
    <Chapter
      id="foundations"
      title="Foundations"
      rule="Plain mint page, white cards, ink lines. Green is the action colour; a screen takes one more accent at most."
    >
      <Demo title="Surfaces">
        {SURFACES.map((surface) => (
          <Swatch key={surface.name} {...surface} />
        ))}
      </Demo>

      <Demo
        title="Colour"
        note="Each hue has a fill that carries ink text and a tint for quiet surfaces. Category colours appear only on action stickers and chart marks."
      >
        {HUES.map((hue) => (
          <div key={hue.name} className="w-36">
            <div className="flex h-16 overflow-hidden rounded-lg border-2 border-ink">
              <div className={cn('flex-1', hue.fill)} />
              <div className={cn('flex-1', hue.tint)} />
            </div>
            <p className="mt-2 text-body-sm font-semibold">{hue.name}</p>
            <p className="text-body-sm text-ink-3">{hue.role}</p>
          </div>
        ))}
      </Demo>

      <Demo
        title="Type"
        note="Five sizes of Space Grotesk. Nothing smaller than 14 px except chart ticks."
        className="flex-col gap-y-4"
      >
        {TYPE.map((step) => (
          <div key={step.name} className="flex w-full flex-wrap items-baseline gap-x-6 gap-y-1">
            <p className={cn('min-w-0', step.className)}>Small steps, real change</p>
            <p className="text-body-sm text-ink-3">
              {step.name} · {step.spec}
            </p>
          </div>
        ))}
      </Demo>

      <Demo
        title="The card"
        note="One recipe: white, a 2 px ink border, a 16 px radius, no shadow."
      >
        <Card className="w-full max-w-sm">
          <h4 className="text-h2">A card</h4>
          <p className="mt-2 text-body text-ink-2">
            Twenty pixels of padding on phones, twenty-four from tablet width.
          </p>
        </Card>
        <Card interactive className="max-w-sm">
          <span className="block text-h2">A card that is a button</span>
          <span className="mt-2 block text-body text-ink-2">
            It sits on a 2 px hard shadow and presses into it.
          </span>
        </Card>
      </Demo>

      <Demo title="Space" className="flex-col gap-y-3">
        {SPACE.map((step) => (
          <div key={step.name} className="flex items-center gap-4">
            <span
              aria-hidden="true"
              className={cn('w-10 shrink-0 rounded-xs bg-green', step.className)}
            />
            <p className="text-body">
              {step.name} <span className="text-ink-3">· {step.spec}</span>
            </p>
          </div>
        ))}
        <p className="text-body-sm text-ink-3">
          Pages are 1120 px wide at most; a text column is 640 px.
        </p>
      </Demo>
    </Chapter>
  );
}
