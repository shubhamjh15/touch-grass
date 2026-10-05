'use client';

import { useEffect, useState, type CSSProperties } from 'react';
import { cn } from '@/lib/cn';
import { CATEGORY, CATEGORY_ORDER, HUES } from '../tokens';
import { Demo, Section } from './parts';

/** Reads a token from the stylesheet, so this page documents the values that are really shipped. */
function readToken(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function channel(value: number): number {
  const c = value / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function luminance(hex: string): number | null {
  const short = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/i.exec(hex);
  const full = short ? `#${short[1]}${short[1]}${short[2]}${short[2]}${short[3]}${short[3]}` : hex;
  const match = /^#([0-9a-f]{6})$/i.exec(full);
  if (!match?.[1]) return null;
  const int = Number.parseInt(match[1], 16);
  return (
    0.2126 * channel((int >> 16) & 255) +
    0.7152 * channel((int >> 8) & 255) +
    0.0722 * channel(int & 255)
  );
}

/** WCAG 2.x contrast ratio between two tokens, or null when one is not a plain hex. */
function contrast(tokens: Record<string, string>, a: string, b: string): number | null {
  const la = luminance(tokens[a] ?? '');
  const lb = luminance(tokens[b] ?? '');
  if (la === null || lb === null) return null;
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

const NEUTRALS = [
  'ink',
  'ink-2',
  'ink-3',
  'ink-4',
  'card',
  'mat',
  'mat-deep',
  'paper',
  'line',
  'kraft',
  'kraft-deep',
  'kraft-dark',
  'bark',
  'bark-deep',
  'moss',
] as const;

const SURFACES = ['card', 'mat', 'mat-deep', 'paper', 'kraft', 'line'] as const;
const INKS = ['ink', 'ink-2', 'ink-3', 'ink-4'] as const;

function collectTokens(): Record<string, string> {
  const names = new Set<string>(NEUTRALS);
  for (const hue of HUES) {
    names.add(hue);
    names.add(`${hue}-deep`);
    names.add(`${hue}-tint`);
  }
  for (const id of CATEGORY_ORDER) {
    for (const suffix of ['', '-deep', '-tint', '-mark']) names.add(`cat-${id}${suffix}`);
  }
  return Object.fromEntries([...names].map((name) => [name, readToken(`--color-${name}`)]));
}

function Ratio({ value, floor = 4.5 }: { value: number | null; floor?: number }) {
  if (value === null) return <span className="text-ink-3">n/a</span>;
  const pass = value >= floor;
  return (
    <span className={cn('whitespace-nowrap', !pass && 'text-ink-3 line-through')}>
      {value.toFixed(2)}
      <span className="sr-only">{pass ? ' passes' : ' rejected'}</span>
    </span>
  );
}

function paint(name: string): CSSProperties {
  return { background: `var(--color-${name})` };
}

const TYPE_ROWS: { token: string; spec: string; className: string; sample: string }[] = [
  {
    token: 'display-hero',
    spec: 'Tilt Warp · 46→104',
    className: 'font-display text-display-hero',
    sample: 'Grow',
  },
  {
    token: 'display-xl',
    spec: 'Tilt Warp · 40→72',
    className: 'font-display text-display-xl',
    sample: 'Planted',
  },
  {
    token: 'display-lg',
    spec: 'Tilt Warp · 32→48',
    className: 'font-display text-display-lg',
    sample: 'Level 6',
  },
  {
    token: 'display-md',
    spec: 'Tilt Warp · 30',
    className: 'type-figure text-display-md',
    sample: '48.2',
  },
  {
    token: 'display-sm',
    spec: 'Tilt Warp · 24',
    className: 'type-figure text-display-sm',
    sample: '12 days',
  },
  {
    token: 'display-xs',
    spec: 'Tilt Warp · 20',
    className: 'type-figure text-display-xs',
    sample: '5',
  },
  { token: 'h1', spec: 'Grotesk 700 · 28→40', className: 'text-h1', sample: 'Afternoon, Sam.' },
  { token: 'h2', spec: 'Grotesk 700 · 22→28', className: 'text-h2', sample: 'How we count carbon' },
  { token: 'h3', spec: 'Grotesk 700 · 20', className: 'text-h3', sample: 'Stick one on' },
  { token: 'h4', spec: 'Grotesk 700 · 17', className: 'text-h4', sample: 'Two-Wheel Tuesday' },
  {
    token: 'reading',
    spec: 'Grotesk 400 · 18/1.65',
    className: 'text-reading',
    sample: 'A short ride replaces the trips that cars are worst at.',
  },
  {
    token: 'lead',
    spec: 'Grotesk 500 · 18',
    className: 'text-lead',
    sample: 'Log an action in five seconds.',
  },
  {
    token: 'body',
    spec: 'Grotesk 500 · 16',
    className: 'text-body',
    sample: 'Your tree waits for you.',
  },
  {
    token: 'body-sm',
    spec: 'Grotesk 500 · 14',
    className: 'text-body-sm',
    sample: 'Cycled instead of driving',
  },
  {
    token: 'caption',
    spec: 'Grotesk 500 · 13',
    className: 'text-caption',
    sample: 'Estimates link to their sources.',
  },
  { token: 'label', spec: 'Grotesk 600 · 15', className: 'text-label', sample: 'Name your tree' },
  {
    token: 'button',
    spec: 'Grotesk 700 · 14/16/18',
    className: 'text-button',
    sample: 'Stick it on',
  },
  { token: 'tab', spec: 'Grotesk 600 · 11', className: 'text-tab', sample: 'Today' },
  {
    token: 'data-lg',
    spec: 'Martian Mono 85% · 17',
    className: 'font-mono text-data-lg',
    sample: '1.02 kg',
  },
  {
    token: 'data',
    spec: 'Martian Mono 85% · 13',
    className: 'font-mono text-data',
    sample: '425/600',
  },
  {
    token: 'data-sm',
    spec: 'Martian Mono 85% · 12',
    className: 'font-mono text-data-sm',
    sample: 'Bike 5 km',
  },
  {
    token: 'type-slug',
    spec: 'Martian Mono 75% · 11',
    className: 'type-slug',
    sample: 'Avoided today',
  },
  {
    token: 'type-tick',
    spec: 'Martian Mono 75% · 10',
    className: 'type-tick',
    sample: 'Grove Nº 0012',
  },
];

const SHADOWS = [
  { name: 'shadow-1', use: 'selected chips, tags', className: 'shadow-1' },
  { name: 'shadow-2', use: 'small buttons, hang tags', className: 'shadow-2' },
  { name: 'shadow-3', use: 'cards, buttons, toasts', className: 'shadow-3' },
  { name: 'shadow-4', use: 'popovers, featured', className: 'shadow-4' },
  { name: 'shadow-5', use: 'carried things, palette', className: 'shadow-5' },
  { name: 'shadow-plate', use: 'one hero per viewport', className: 'shadow-plate' },
  { name: 'deboss', use: 'things you fill', className: 'deboss' },
  { name: 'dieline', use: 'not there yet', className: 'dieline' },
] as const;

const RADII = [
  { name: 'paper · 4', use: 'printed matter', className: 'rounded-paper' },
  { name: 'xs · 6', use: 'tags, checkbox', className: 'rounded-xs' },
  { name: 'sm · 8', use: 'small controls', className: 'rounded-sm' },
  { name: 'ctl · 10', use: 'press or fill', className: 'rounded-ctl' },
  { name: 'md · 12', use: 'objects, mobile', className: 'rounded-md' },
  { name: 'lg · 16', use: 'containers', className: 'rounded-lg' },
  { name: 'xl · 24', use: 'overlays', className: 'rounded-xl' },
  { name: 'pill', use: 'stickers, chips', className: 'rounded-pill' },
] as const;

const BORDERS = [
  { name: 'hair · 1.5', use: 'a cut or a measure', className: 'border-t-[1.5px]' },
  { name: 'thin · 2', use: 'a part of a thing', className: 'border-t-2' },
  { name: 'base · 3', use: 'a thing', className: 'border-t-3' },
  { name: 'bold · 4', use: 'a container', className: 'border-t-4' },
  { name: 'mega · 6', use: 'landing hero only', className: 'border-t-6' },
  { name: 'dashed ink', use: 'a line you can tear', className: 'border-t-2 border-dashed' },
  {
    name: 'dashed ink-4',
    use: 'not there yet',
    className: 'border-t-2 border-dashed border-ink-4',
  },
] as const;

export function TokensSection({ index }: { index: number }) {
  const [tokens, setTokens] = useState<Record<string, string>>({});
  // Computed styles exist only in the browser, so the values are read once the page has mounted.
  useEffect(() => {
    setTokens(collectTokens());
  }, []);

  return (
    <Section
      id="tokens"
      index={index}
      title="Tokens"
      note="Read live from the stylesheet · ratios are WCAG 2.x · struck through = rejected pair"
    >
      <Demo label="Ink on surfaces" note="Body text needs 4.5:1.">
        <div className="relative w-full overflow-x-auto rounded-md border-3 border-ink bg-card shadow-3">
          <table className="w-full min-w-[560px] border-collapse text-left font-mono text-data">
            <thead>
              <tr className="border-b-[1.5px] border-ink">
                <th scope="col" className="px-3 py-2 type-slug font-semibold text-ink-3">
                  Text \ surface
                </th>
                {SURFACES.map((surface) => (
                  <th
                    key={surface}
                    scope="col"
                    className="px-3 py-2 type-slug font-semibold text-ink-3"
                  >
                    {surface}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {INKS.map((ink) => (
                <tr key={ink} className="border-b border-line last:border-b-0">
                  <th scope="row" className="px-3 py-2 font-semibold">
                    {ink} <span className="font-medium text-ink-3">{tokens[ink]}</span>
                  </th>
                  {SURFACES.map((surface) => (
                    <td key={surface} className="p-1.5">
                      <span
                        className="flex h-9 items-center justify-center rounded-xs border-2 border-ink px-2 font-semibold"
                        style={{ ...paint(surface), color: `var(--color-${ink})` }}
                      >
                        <Ratio value={contrast(tokens, ink, surface)} />
                      </span>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Demo>

      <Demo
        label="Hues"
        note="Fill carries ink text only · deep is the only coloured text · tint is a quiet surface."
        className="grid grid-cols-2 gap-4 sm:grid-cols-4 xl:grid-cols-8"
      >
        {HUES.map((hue) => (
          <div
            key={hue}
            className="overflow-hidden rounded-md border-3 border-ink bg-card shadow-3"
          >
            <div className="flex h-16 flex-col justify-end p-2 text-ink" style={paint(hue)}>
              <span className="text-body-sm font-bold">{hue}</span>
            </div>
            <dl className="grid gap-1 border-t-3 border-ink p-2 font-mono text-data-sm">
              <div className="flex justify-between gap-2">
                <dt className="text-ink-3">{tokens[hue]}</dt>
                <dd>
                  <Ratio value={contrast(tokens, 'ink', hue)} />
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-ink-3">white</dt>
                <dd>
                  <Ratio value={contrast(tokens, 'card', hue)} />
                </dd>
              </div>
            </dl>
            <div
              className="flex items-center justify-between gap-2 border-t-2 border-ink px-2 py-1.5 font-mono text-data-sm font-semibold"
              style={{ ...paint(`${hue}-tint`), color: `var(--color-${hue}-deep)` }}
            >
              <span>deep</span>
              <Ratio value={contrast(tokens, `${hue}-deep`, `${hue}-tint`)} />
            </div>
          </div>
        ))}
      </Demo>

      <Demo
        label="Categories"
        note="Canonical order wherever two category colours touch: stuff, power, waste, water, eat, move, nature. Marks are chart ink (3:1 on card)."
        className="grid grid-cols-2 gap-4 sm:grid-cols-4 xl:grid-cols-7"
      >
        {CATEGORY_ORDER.map((id) => (
          <div key={id} className="overflow-hidden rounded-md border-3 border-ink bg-card shadow-3">
            <div className="flex h-14 items-end p-2 text-ink" style={paint(`cat-${id}`)}>
              <span className="text-body-sm font-bold">{CATEGORY[id].label}</span>
            </div>
            <dl className="grid gap-1 border-t-3 border-ink p-2 font-mono text-data-sm">
              <div className="flex justify-between gap-2">
                <dt className="text-ink-3">ink on fill</dt>
                <dd>
                  <Ratio value={contrast(tokens, 'ink', `cat-${id}`)} />
                </dd>
              </div>
              <div className="flex items-center justify-between gap-2">
                <dt className="flex items-center gap-1.5 text-ink-3">
                  <span className="size-3 rounded-[3px]" style={paint(`cat-${id}-mark`)} />
                  mark
                </dt>
                <dd>
                  <Ratio value={contrast(tokens, `cat-${id}-mark`, 'card')} floor={3} />
                </dd>
              </div>
            </dl>
          </div>
        ))}
      </Demo>

      <Demo
        label="Neutrals and materials"
        className="grid grid-cols-3 gap-3 sm:grid-cols-5 lg:grid-cols-8"
      >
        {NEUTRALS.map((name) => (
          <div key={name} className="min-w-0">
            <div className="h-12 rounded-sm border-2 border-ink" style={paint(name)} />
            <p className="mt-1.5 truncate text-caption font-semibold">{name}</p>
            <p className="font-mono text-data-sm text-ink-3">{tokens[name]}</p>
          </div>
        ))}
      </Demo>

      <Demo
        label="Type scale"
        note="Three families, one job each: Space Grotesk speaks, Tilt Warp is proud, Martian Mono measures."
      >
        <div className="w-full divide-y-[1.5px] divide-ink rounded-md border-3 border-ink bg-card shadow-3">
          {TYPE_ROWS.map((row) => (
            <div
              key={row.token}
              className="grid items-baseline gap-x-4 gap-y-1 px-4 py-3 md:grid-cols-[200px_1fr]"
            >
              <p className="type-slug leading-[1.5] text-ink-3">
                {row.token}
                <br />
                {row.spec}
              </p>
              <p className={cn('min-w-0 break-words', row.className)}>{row.sample}</p>
            </div>
          ))}
        </div>
      </Demo>

      <Demo
        label="Shadows"
        note="One lamp, top-left. Hard, ink, down-right. Raised things are pressed, sunk things are filled, print is flat."
      >
        {SHADOWS.map((shadow) => (
          <div key={shadow.name} className="w-[136px]">
            <div className={cn('h-16 rounded-md border-3 border-ink bg-card', shadow.className)} />
            <p className="mt-4 text-caption font-semibold">{shadow.name}</p>
            <p className="text-caption text-ink-3">{shadow.use}</p>
          </div>
        ))}
      </Demo>

      <Demo label="Radii" note="The radius says what kind of thing it is.">
        {RADII.map((radius) => (
          <div key={radius.name} className="w-[104px]">
            <div className={cn('h-14 border-3 border-ink bg-card', radius.className)} />
            <p className="mt-2 text-caption font-semibold">{radius.name}</p>
            <p className="text-caption text-ink-3">{radius.use}</p>
          </div>
        ))}
      </Demo>

      <Demo
        label="Borders"
        note="The weight says how important the edge is."
        className="grid gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-4"
      >
        {BORDERS.map((border) => (
          <div key={border.name}>
            <div className={cn('border-ink', border.className)} />
            <p className="mt-2 text-caption font-semibold">{border.name}</p>
            <p className="text-caption text-ink-3">{border.use}</p>
          </div>
        ))}
      </Demo>
    </Section>
  );
}
