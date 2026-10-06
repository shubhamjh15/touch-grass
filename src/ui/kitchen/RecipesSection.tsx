'use client';

import type { CSSProperties, ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { Demo, Section } from './parts';

function Recipe({
  name,
  use,
  className,
  children,
}: {
  name: string;
  use: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <figure className={cn('flex w-[168px] flex-col', className)}>
      <div className="grid h-24 place-items-center">{children}</div>
      <figcaption className="mt-3">
        <code className="font-mono text-data font-semibold">{name}</code>
        <span className="mt-0.5 block text-caption text-ink-3">{use}</span>
      </figcaption>
    </figure>
  );
}

const BOX =
  'grid h-14 w-28 place-items-center rounded-ctl border-3 border-ink bg-card text-caption font-semibold';

export function RecipesSection({ index }: { index: number }) {
  return (
    <Section
      id="recipes"
      index={index}
      title="Recipes"
      note="@utility classes from src/styles/index.css · flat ink on paper, cut with scissors, lit by one lamp"
    >
      <Demo
        label="Emboss and deboss"
        note="Raised things are pressed; sunk things are filled; anything focusable uses these, never a shadow utility."
      >
        <Recipe name="hard lift-3" use="small buttons">
          <button type="button" className={cn(BOX, 'hard lift-3')}>
            Press me
          </button>
        </Recipe>
        <Recipe name="hard lift-5" use="buttons, default">
          <button type="button" className={cn(BOX, 'hard bg-green lift-5')}>
            Press me
          </button>
        </Recipe>
        <Recipe name="hard lift-8" use="hero press">
          <button type="button" className={cn(BOX, 'hard bg-yellow lift-8')}>
            Press me
          </button>
        </Recipe>
        <Recipe name="hard hard-card" use="interactive cards">
          <button type="button" className={cn(BOX, 'hard hard-card rounded-md lift-5')}>
            Hover me
          </button>
        </Recipe>
        <Recipe name="flat-3" use="static shadow, focusable">
          <button type="button" className={cn(BOX, '-rotate-[1.5deg] bg-yellow flat-3')}>
            Current
          </button>
        </Recipe>
        <Recipe name="deboss" use="inputs, wells, tracks">
          <div className={cn(BOX, 'font-medium text-ink-4 deboss')}>Fill me</div>
        </Recipe>
        <Recipe name="focus ring" use="5 px halo + 2 px keyline">
          <div
            className={cn(BOX, 'outline-2 outline-offset-[5px] outline-ink')}
            style={
              {
                boxShadow: '0 0 0 5px var(--color-focus), 5px 5px 0 0 var(--color-shadow)',
              } as CSSProperties
            }
          >
            Focused
          </div>
        </Recipe>
        <Recipe name="focus-inset" use="tabs, rows, segments">
          <div
            className={cn(BOX, 'outline-2 -outline-offset-[6px] outline-ink')}
            style={{ boxShadow: 'inset 0 0 0 4px var(--color-focus)' } as CSSProperties}
          >
            Focused
          </div>
        </Recipe>
      </Demo>

      <Demo
        label="Die-cut"
        note="White margin, 1.5 px kiss-cut line, hard shadow that follows the radius."
      >
        <Recipe name="diecut dc-3" use="≤ 32 px things">
          <span className="inline-flex h-7 diecut items-center rounded-pill border-3 border-ink bg-yellow px-2.5 text-caption font-bold dc-3">
            dc-3
          </span>
        </Recipe>
        <Recipe name="diecut dc-4" use="default">
          <span className="inline-flex h-8 -rotate-2 diecut items-center rounded-pill border-3 border-ink bg-pink px-3 text-body-sm font-bold dc-4">
            dc-4
          </span>
        </Recipe>
        <Recipe name="diecut dc-6" use="hero">
          <span className="grid size-14 -rotate-4 diecut place-items-center rounded-[22px] border-4 border-ink bg-green text-body-sm font-bold dc-6">
            dc-6
          </span>
        </Recipe>
        <Recipe name="dieline" use="not there yet">
          <div className="grid h-14 w-28 place-items-center rounded-ctl dieline type-tick text-ink-3">
            Nº 07
          </div>
        </Recipe>
        <Recipe name="stack" use="a deck of sheets">
          <div className="stack relative isolate grid h-14 w-28 place-items-center rounded-md border-3 border-ink bg-card text-caption font-semibold">
            3 quests
          </div>
        </Recipe>
      </Demo>

      <Demo
        label="Textures"
        note="Halftone is the only way to draw a gradient. Hatch = projected or loading. At most three texture layers per viewport."
      >
        <Recipe name="halftone" use="dots, 7 px pitch">
          <div className="h-16 w-32 rounded-sm border-2 border-ink bg-white halftone" />
        </Recipe>
        <Recipe name="halftone-fade-t" use="band seams, 49 px">
          <div className="h-20 w-32 overflow-hidden rounded-sm border-2 border-ink bg-(--sky-day-0)">
            <div className="halftone-fade-t mt-12 h-8 bg-(--sky-dusk-1) text-(--sky-dusk-1)" />
          </div>
        </Recipe>
        <Recipe name="hatch" use="projected, loading">
          <div className="h-16 w-32 rounded-sm border-2 border-line bg-white hatch [--hatch:var(--color-ink-4)]" />
        </Recipe>
        <Recipe name="graph-paper" use="the cutting mat">
          <div className="h-16 w-32 rounded-sm border-2 border-ink graph-paper" />
        </Recipe>
        <Recipe name="scrim" use="veil behind overlays">
          <div className="h-16 w-32 overflow-hidden rounded-sm border-2 border-ink bg-green">
            <div className="size-full scrim" />
          </div>
        </Recipe>
        <Recipe name="stamp-ink" use="uneven inking">
          <div className="h-14 w-28 rounded-sm bg-pink-deep stamp-ink" />
        </Recipe>
        <Recipe name="crop-marks" use="printer's corners">
          <div className="relative h-16 w-32 bg-(--sky-day-1)">
            <div className="absolute inset-2 crop-marks" />
          </div>
        </Recipe>
      </Demo>

      <Demo
        label="Edges, perforations, tape"
        note="Solid ink = a real edge. Dashed ink = a line you can tear. Pinking shears where the mat meets the sky."
      >
        <Recipe name="edge-pinked-t" use="mat horizon (mobile)">
          <div className="h-20 w-36 overflow-hidden rounded-sm border-2 border-ink bg-(--sky-day-1)">
            <div className="edge-pinked-t mt-10 h-10 bg-mat" />
          </div>
        </Recipe>
        <Recipe name="edge-pinked-l" use="the desk (desktop)">
          <div className="flex h-20 w-36 justify-end overflow-hidden rounded-sm border-2 border-ink bg-(--sky-day-1)">
            <div className="edge-pinked-l h-full w-16 bg-mat" />
          </div>
        </Recipe>
        <Recipe name="edge-pinked-b" use="receipts">
          <div className="edge-pinked-b h-12 w-28 rounded-t-sm border-3 border-b-0 border-ink bg-paper" />
        </Recipe>
        <Recipe name="perf-l" use="ticket stubs">
          <div className="flex h-14 w-36 rounded-md border-3 border-ink bg-card">
            <div className="flex-1" />
            <div className="perf-l w-14" />
          </div>
        </Recipe>
        <Recipe name="perf-t" use="vertical tickets">
          <div className="flex h-20 w-28 flex-col rounded-md border-3 border-ink bg-card">
            <div className="flex-1" />
            <div className="perf-t h-8" />
          </div>
        </Recipe>
        <Recipe name="tape" use="washi strip">
          <div className="relative h-12 w-32 rounded-paper border-3 border-ink bg-yellow-tint">
            <i className="tape" />
          </div>
        </Recipe>
      </Demo>

      <Demo label="Type helpers" className="items-end">
        <Recipe name="lettering" use="die-cut display words">
          <span className="lettering text-display-md [--fill:var(--color-green)]" data-text="Grow">
            Grow
          </span>
        </Recipe>
        <Recipe name="type-figure" use="proud numerals">
          <span className="type-figure text-display-md">48.2</span>
        </Recipe>
        <Recipe name="type-slug" use="keys, tags, meta">
          <span className="type-slug text-ink-3">Avoided today</span>
        </Recipe>
        <Recipe name="type-tick" use="axis ticks, print slug">
          <span className="type-tick text-ink-3">Tue 06 Oct 2026</span>
        </Recipe>
        <Recipe name="highlighter" use="emphasis in a headline">
          <span className="text-h3">
            a <span className="highlighter">living</span> tree
          </span>
        </Recipe>
        <Recipe name="link" use="inline link">
          <a href="#recipes" className="link">
            Open methodology
          </a>
        </Recipe>
      </Demo>

      <Demo label="Layout helpers" className="grid gap-2 font-mono text-data">
        <p>
          <b>scroll-row</b>{' '}
          <span className="text-ink-3">horizontal snap rows without a scrollbar</span>
        </p>
        <p>
          <b>hit-1 · hit-2 · hit-3</b>{' '}
          <span className="text-ink-3">extend a small control&rsquo;s target by 4 / 8 / 12 px</span>
        </p>
        <p>
          <b>pt-safe · pb-safe · pb-sheet · px-gutter · pb-tabbar</b>{' '}
          <span className="text-ink-3">safe areas and the tab bar clearance</span>
        </p>
        <p>
          <b>calm: · fine: · off:</b>{' '}
          <span className="text-ink-3">
            variants for reduced motion (OS or setting), fine pointers, and disabled / aria-disabled
          </span>
        </p>
        <p>
          <b>z-(--z-nav)</b>{' '}
          <span className="text-ink-3">
            sky 0 · world 1 · content 10 · sticky 20 · nav 30 · fab 31 · scrim 39 · drawer 40 ·
            modal 50 · palette 60 · toast 70 · tooltip 80 · fx 90 · skip 100
          </span>
        </p>
      </Demo>
    </Section>
  );
}
