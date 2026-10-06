'use client';

import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { cn } from '@/lib/cn';
import {
  ISLAND_PROPS,
  SPECIES,
  WorldStage,
  captureWorld,
  emitPulse,
  getStickingPoint,
  getWorldStats,
  measureWorld,
  onWorldHover,
  onWorldTap,
  setWorldSnapshot,
  useWorldStore,
  type IslandPropId,
  type LandmarkId,
  type Species,
  type StageMode,
  type WorldMotion,
  type WorldPreference,
  type WorldPulse,
  type WorldStats,
} from '@/world';

/**
 * World lab (dev only, /__world). Drives the world exactly like the game bridge does:
 * `setWorldSnapshot()` plus `<WorldStage>` props. Every control is mirrored in the URL,
 * so a screenshot of any state can be scripted:
 *
 *   /__world?species=cherry&growth=0.6&hour=19&mode=hero&quality=high   (quality defaults to auto)
 *   /__world?stage=sapling&vitality=0.5     a growth stage by name, a thirsty tree
 *   /__world?bare=1                         the stage alone, filling the window (for stills)
 *   /__world?pulse=level-up            fires that pulse about 600 ms after the world is ready
 *   /__world?props=all&landmarks=1     every prop, landmark callouts on
 *   /__world?preview=0.9               the stage previews that growth over the live snapshot
 *   /__world?capture=1                 runs captureWorld() once ready and shows the PNG
 */

const PULSES: ReadonlyArray<{ id: string; label: string; pulse: WorldPulse }> = [
  { id: 'grow', label: 'Grow', pulse: { kind: 'grow', strength: 0.6 } },
  { id: 'grow-max', label: 'Grow (max)', pulse: { kind: 'grow', strength: 1 } },
  { id: 'ring', label: 'Ring', pulse: { kind: 'ring' } },
  { id: 'water', label: 'Water', pulse: { kind: 'water' } },
  { id: 'level-up', label: 'Level up', pulse: { kind: 'level-up', level: 6 } },
  { id: 'badge', label: 'Badge', pulse: { kind: 'badge' } },
  { id: 'streak', label: 'Streak 30', pulse: { kind: 'streak', days: 30 } },
  { id: 'plant', label: 'Plant', pulse: { kind: 'plant' } },
  { id: 'celebrate', label: 'Celebrate', pulse: { kind: 'celebrate' } },
];
const INTERACTIVE = ['auto', 'on', 'off'] as const;

/** The seven growth stages a judge can see, with the growth each one starts at. */
const STAGES = [
  { id: 'seed', label: 'Seed', growth: 0 },
  { id: 'sprout', label: 'Sprout', growth: 0.03 },
  { id: 'seedling', label: 'Seedling', growth: 0.07 },
  { id: 'sapling', label: 'Sapling', growth: 0.14 },
  { id: 'young', label: 'Young tree', growth: 0.36 },
  { id: 'mature', label: 'Mature tree', growth: 0.66 },
  { id: 'elder', label: 'Elder', growth: 0.95 },
] as const;

const VITALITIES = [
  { id: 'thriving', label: 'Thriving', vitality: 1 },
  { id: 'thirsty', label: 'Thirsty', vitality: 0.5 },
  { id: 'dormant', label: 'Dormant', vitality: 0 },
] as const;

const HOURS = [
  { label: 'Dawn', hour: 6.2 },
  { label: 'Day', hour: 13 },
  { label: 'Golden', hour: 18.2 },
  { label: 'Night', hour: 23 },
] as const;

const MODES: readonly StageMode[] = ['hero', 'hub', 'companion', 'ceremony'];
const QUALITIES: readonly WorldPreference[] = ['auto', 'low', 'medium', 'high', 'off'];
const MOTIONS: readonly WorldMotion[] = ['system', 'reduced', 'full'];
const BOXES = ['hero', 'wide', 'card', 'thumb'] as const;
const SKIES = ['auto', 'on', 'off'] as const;
const ANCHORS = ['bottom', 'center'] as const;

type BoxSize = (typeof BOXES)[number];

interface LabState {
  species: Species;
  growth: number;
  vitality: number;
  age: number;
  hour: number;
  seed: number;
  props: IslandPropId[];
  mode: StageMode;
  fit: number;
  anchor: (typeof ANCHORS)[number];
  sky: (typeof SKIES)[number];
  box: BoxSize;
  quality: WorldPreference;
  motion: WorldMotion;
  second: boolean;
  tall: boolean;
  landmarks: boolean;
  interactive: (typeof INTERACTIVE)[number];
  /** Growth the stage previews over the live snapshot; negative = no preview. */
  preview: number;
  capture: boolean;
  /** The stage alone, filling the window: no controls. */
  bare: boolean;
}

const DEFAULTS: LabState = {
  species: 'oak',
  growth: 0.6,
  vitality: 1,
  age: 12,
  hour: 13,
  seed: 12,
  props: [],
  mode: 'hero',
  fit: 0.86,
  anchor: 'bottom',
  sky: 'auto',
  box: 'hero',
  quality: 'auto',
  motion: 'system',
  second: false,
  tall: false,
  landmarks: false,
  interactive: 'auto',
  preview: -1,
  capture: false,
  bare: false,
};

const BOX_CLASS: Record<BoxSize, string> = {
  hero: 'h-[62vh] min-h-80 w-full lg:h-[calc(100vh-3rem)]',
  wide: 'h-64 w-full',
  card: 'size-72',
  thumb: 'size-32',
};

function oneOf<T extends string>(value: string | null, options: readonly T[], fallback: T): T {
  return options.includes(value as T) ? (value as T) : fallback;
}

function numberIn(value: string | null, min: number, max: number, fallback: number): number {
  const parsed = value === null || value === '' ? Number.NaN : Number(value);
  return Number.isFinite(parsed) ? Math.min(max, Math.max(min, parsed)) : fallback;
}

function readUrl(): LabState {
  const query = new URLSearchParams(window.location.search);
  const flag = (name: string, fallback: boolean) =>
    query.has(name) ? !['0', 'false', 'off'].includes(query.get(name) ?? '') : fallback;
  return {
    species: oneOf(query.get('species'), SPECIES, DEFAULTS.species),
    growth: numberIn(
      query.get('growth'),
      0,
      1,
      STAGES.find((stage) => stage.id === query.get('stage'))?.growth ?? DEFAULTS.growth,
    ),
    vitality: numberIn(query.get('vitality'), 0, 1, DEFAULTS.vitality),
    age: numberIn(query.get('age') ?? query.get('ageDays'), 0, 100_000, DEFAULTS.age),
    hour: numberIn(query.get('hour'), 0, 24, DEFAULTS.hour),
    seed: Math.round(numberIn(query.get('seed'), 0, 4_294_967_295, DEFAULTS.seed)),
    props:
      query.get('props') === 'all'
        ? [...ISLAND_PROPS]
        : (query.get('props') ?? '')
            .split(',')
            .filter((id): id is IslandPropId => ISLAND_PROPS.includes(id as IslandPropId)),
    mode: oneOf(query.get('mode'), MODES, DEFAULTS.mode),
    fit: numberIn(query.get('fit'), 0.2, 1, DEFAULTS.fit),
    anchor: oneOf(query.get('anchor'), ANCHORS, DEFAULTS.anchor),
    sky: oneOf(query.get('sky'), SKIES, DEFAULTS.sky),
    box: oneOf(query.get('box'), BOXES, DEFAULTS.box),
    quality: oneOf(query.get('quality'), QUALITIES, DEFAULTS.quality),
    motion: oneOf(query.get('motion'), MOTIONS, DEFAULTS.motion),
    second: flag('second', DEFAULTS.second),
    tall: flag('tall', DEFAULTS.tall),
    landmarks: flag('landmarks', DEFAULTS.landmarks),
    interactive: oneOf(query.get('interactive'), INTERACTIVE, DEFAULTS.interactive),
    preview: numberIn(query.get('preview'), -1, 1, DEFAULTS.preview),
    capture: flag('capture', DEFAULTS.capture),
    bare: flag('bare', DEFAULTS.bare),
  };
}

function writeUrl(state: LabState): void {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(state)) {
    const fallback = DEFAULTS[key as keyof LabState];
    const text = Array.isArray(value) ? value.join(',') : String(value);
    const base = Array.isArray(fallback) ? fallback.join(',') : String(fallback);
    if (text !== base) query.set(key, typeof value === 'boolean' ? (value ? '1' : '0') : text);
  }
  const search = query.toString();
  window.history.replaceState(null, '', search ? `?${search}` : window.location.pathname);
}

const fieldClass =
  'h-11 w-full rounded-lg border-4 border-ink bg-white px-2 font-medium focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-focus';

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: (id: string) => ReactNode;
}) {
  const id = useId();
  return (
    <div className="grid gap-1">
      <label htmlFor={id} className="text-sm flex items-baseline justify-between font-bold">
        <span>{label}</span>
        {hint !== undefined && <span className="font-medium tabular-nums">{hint}</span>}
      </label>
      {children(id)}
    </div>
  );
}

function Choice<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: readonly T[];
  onChange: (value: T) => void;
}) {
  return (
    <Field label={label}>
      {(id) => (
        <select
          id={id}
          value={value}
          className={fieldClass}
          onChange={(event) => onChange(event.target.value as T)}
        >
          {options.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      )}
    </Field>
  );
}

function Slider({
  label,
  value,
  min,
  max,
  step,
  digits,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  digits: number;
  onChange: (value: number) => void;
}) {
  return (
    <Field label={label} hint={value.toFixed(digits)}>
      {(id) => (
        <input
          id={id}
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          className="h-11 w-full accent-green"
          onChange={(event) => onChange(Number(event.target.value))}
        />
      )}
    </Field>
  );
}

function Readout() {
  const status = useWorldStore((state) => state.status);
  const quality = useWorldStore((state) => state.quality);
  const [stats, setStats] = useState<WorldStats>(getWorldStats);

  useEffect(() => {
    // The frame-time sampler is a dev tool: on while the lab is open.
    measureWorld(true);
    const timer = window.setInterval(() => setStats(getWorldStats()), 400);
    return () => {
      window.clearInterval(timer);
      measureWorld(false);
    };
  }, []);

  const rows: Array<[string, string]> = [
    ['status', status],
    ['tier', quality],
    ['draw calls', String(stats.drawCalls)],
    ['triangles', stats.triangles.toLocaleString('en')],
    ['fps', stats.fps.toFixed(0)],
    ['frame', `${stats.frameMs.toFixed(1)} ms`],
    ['frame p95', `${stats.p95Ms.toFixed(1)} ms`],
    ['frame worst', `${stats.worstMs.toFixed(1)} ms`],
    ['script / frame', `${stats.cpuMs.toFixed(2)} ms`],
    ['gpu / frame', stats.gpuMs > 0 ? `${stats.gpuMs.toFixed(2)} ms` : 'n/a'],
    ['buffer', `${stats.bufferWidth} × ${stats.bufferHeight}`],
    ['dpr', stats.dpr.toFixed(2)],
    ['dpr scale', stats.dprScale.toFixed(2)],
    ['shown growth', stats.growth.toFixed(3)],
    ['px / unit', stats.scale.toFixed(1)],
    ['frames', String(stats.frames)],
    ['geometries', String(stats.geometries)],
    ['textures', String(stats.textures)],
    ['programs', String(stats.programs)],
  ];
  return (
    <dl
      data-world-readout
      className="text-sm grid grid-cols-2 gap-x-3 gap-y-1 rounded-lg border-4 border-ink bg-mat p-3 tabular-nums"
    >
      {rows.map(([name, value]) => (
        <div key={name} className="contents">
          <dt className="font-bold">{name}</dt>
          <dd className="text-right" data-stat={name}>
            {value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

const labButton =
  'min-h-11 rounded-lg border-4 border-ink px-3 font-bold shadow-2 active:translate-x-[3px] active:translate-y-[3px] active:shadow-none focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-focus';

/** Runs `captureWorld()` and shows the PNG it returns, at the size it was asked for. */
function CapturePreview({ auto }: { auto: boolean }) {
  const status = useWorldStore((state) => state.status);
  const [shot, setShot] = useState<{ url: string; bytes: number; ms: number } | null>(null);
  const [note, setNote] = useState('');
  const ran = useRef(false);

  const capture = async () => {
    setNote('Capturing…');
    const started = performance.now();
    const blob = await captureWorld({ width: 1080, height: 1080 });
    if (!blob) {
      setNote('captureWorld() returned null (3D is off or not ready).');
      return;
    }
    setShot((previous) => {
      if (previous) URL.revokeObjectURL(previous.url);
      return {
        url: URL.createObjectURL(blob),
        bytes: blob.size,
        ms: performance.now() - started,
      };
    });
    setNote('');
  };

  useEffect(() => {
    if (!auto || ran.current || status !== 'ready') return;
    ran.current = true;
    const timer = window.setTimeout(() => void capture(), 900);
    return () => window.clearTimeout(timer);
  }, [auto, status]);

  return (
    <fieldset className="grid gap-2">
      <legend className="text-sm mb-1 font-bold">Capture (captureWorld 1080 × 1080)</legend>
      <button
        type="button"
        data-lab="capture"
        className={cn(labButton, 'bg-pink')}
        onClick={() => void capture()}
      >
        Capture PNG
      </button>
      {note && (
        <p className="text-sm font-medium" role="status">
          {note}
        </p>
      )}
      {shot && (
        <figure className="grid gap-1" data-lab="capture-result">
          <img
            src={shot.url}
            alt="Captured world"
            className="w-full rounded-lg border-4 border-ink"
          />
          <figcaption className="text-sm font-medium tabular-nums">
            {(shot.bytes / 1024).toFixed(0)} kB PNG in {shot.ms.toFixed(0)} ms
          </figcaption>
        </figure>
      )}
    </fieldset>
  );
}

/** Marks where `getStickingPoint()` says a logged action lands. */
function StickingDot() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const point = getStickingPoint();
      const el = ref.current;
      if (el) {
        el.style.opacity = point ? '1' : '0';
        if (point) el.style.transform = `translate(${point.x - 6}px, ${point.y - 6}px)`;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);
  return (
    <div
      ref={ref}
      aria-hidden="true"
      className="pointer-events-none fixed top-0 left-0 z-50 size-3 rounded-full border-2 border-ink bg-tomato opacity-0"
    />
  );
}

export default function WorldLabPage() {
  const [lab, setLab] = useState<LabState>(readUrl);
  const status = useWorldStore((state) => state.status);
  const [lastLandmark, setLastLandmark] = useState<LandmarkId | null>(null);
  const [showSticking, setShowSticking] = useState(false);
  const [hovered, setHovered] = useState<string | null>(null);
  const [tapped, setTapped] = useState<string | null>(null);

  // Hit-testing: the part under the pointer and the last part tapped.
  useEffect(() => {
    const stopHover = onWorldHover((hit) => setHovered(hit ? hit.part : null));
    const stopTap = onWorldTap((hit) => setTapped(hit.part));
    return () => {
      stopHover();
      stopTap();
    };
  }, []);

  // `?pulse=level-up` fires once, about 600 ms after the world is ready (for screenshots).
  const fired = useRef(false);
  useEffect(() => {
    if (fired.current || status !== 'ready') return;
    const wanted = new URLSearchParams(window.location.search).get('pulse');
    const entry = PULSES.find((item) => item.id === wanted);
    if (!entry) return;
    fired.current = true;
    const timer = window.setTimeout(() => emitPulse(entry.pulse), 600);
    return () => window.clearTimeout(timer);
  }, [status]);

  const change = (patch: Partial<LabState>) => {
    const next = { ...lab, ...patch };
    setLab(next);
    writeUrl(next);
  };

  // The lab is the "game bridge" here: push its state into the world, as the app will.
  useEffect(() => {
    setWorldSnapshot({
      species: lab.species,
      growth: lab.growth,
      vitality: lab.vitality,
      ageDays: lab.age,
      hour: lab.hour,
      seed: lab.seed,
      props: lab.props,
    });
  }, [lab.species, lab.growth, lab.vitality, lab.age, lab.hour, lab.seed, lab.props]);

  useEffect(() => {
    const { setPreference, setMotion } = useWorldStore.getState();
    setPreference(lab.quality);
    setMotion(lab.motion);
  }, [lab.quality, lab.motion]);

  const sky = lab.sky === 'auto' ? undefined : lab.sky === 'on';
  const interactive = lab.interactive === 'auto' ? undefined : lab.interactive === 'on';
  const preview = lab.preview >= 0 ? { growth: lab.preview } : undefined;

  if (lab.bare) {
    return (
      <main className="h-screen w-full">
        <WorldStage
          mode={lab.mode}
          fit={lab.fit}
          anchor={lab.anchor}
          sky={sky}
          interactive={interactive}
          landmarks={lab.landmarks}
          preview={preview}
          label={`${lab.species} at growth ${lab.growth.toFixed(2)}`}
          className="size-full"
        />
      </main>
    );
  }

  return (
    <main className="mx-auto grid max-w-[1400px] gap-6 p-4 lg:grid-cols-[minmax(0,1fr)_22rem] lg:p-6">
      <section aria-label="Stage" className="grid content-start gap-6">
        <WorldStage
          mode={lab.mode}
          fit={lab.fit}
          anchor={lab.anchor}
          sky={sky}
          interactive={interactive}
          landmarks={lab.landmarks}
          onLandmark={setLastLandmark}
          landmarkMeta={{ quests: '1/3', impact: `${lab.age} rings` }}
          preview={preview}
          label={`${lab.species} at growth ${lab.growth.toFixed(2)}`}
          className={cn('rounded-xl border-4 border-ink', BOX_CLASS[lab.box])}
        />
        {showSticking && <StickingDot />}

        {lab.second && (
          <div className="rounded-xl border-4 border-dashed border-ink p-4">
            <p className="mb-3 font-bold">Second stage (priority 1): the Grove flies here.</p>
            <WorldStage
              mode="companion"
              priority={1}
              sky
              label="Second stage"
              className="ml-auto size-56 rounded-xl border-4 border-ink"
            />
          </div>
        )}

        {lab.tall &&
          ['Scroll', 'locking', 'test', 'area'].map((word) => (
            <div
              key={word}
              className="text-4xl grid h-96 place-items-center rounded-xl border-4 border-ink bg-white font-bold shadow-3"
            >
              {word}
            </div>
          ))}
      </section>

      <aside
        aria-label="Controls"
        className="grid content-start gap-4 rounded-xl border-4 border-ink bg-white p-4 shadow-3 lg:sticky lg:top-6 lg:max-h-[calc(100vh-3rem)] lg:overflow-y-auto"
      >
        <h1 className="text-2xl font-bold">World lab</h1>
        <Readout />

        <fieldset className="grid gap-2">
          <legend className="text-sm mb-1 font-bold">Pulses (emitPulse)</legend>
          <div className="grid grid-cols-3 gap-2">
            {PULSES.map((item) => (
              <button
                key={item.id}
                type="button"
                data-pulse={item.id}
                className={cn(labButton, 'text-sm bg-green px-1')}
                onClick={() => emitPulse(item.pulse)}
              >
                {item.label}
              </button>
            ))}
          </div>
        </fieldset>

        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            aria-pressed={lab.landmarks}
            data-lab="landmarks"
            className={cn(labButton, 'bg-yellow')}
            onClick={() => change({ landmarks: !lab.landmarks })}
          >
            {lab.landmarks ? 'Hide landmarks' : 'Show landmarks'}
          </button>
          <Choice
            label="Interactive"
            value={lab.interactive}
            options={INTERACTIVE}
            onChange={(next) => change({ interactive: next })}
          />
          <button
            type="button"
            aria-pressed={showSticking}
            data-lab="sticking"
            className={cn(labButton, 'col-span-2 bg-white')}
            onClick={() => setShowSticking((shown) => !shown)}
          >
            {showSticking ? 'Hide sticking point' : 'Show sticking point'}
          </button>
        </div>
        <p className="text-sm font-medium" role="status" data-lab="landmark">
          Last landmark: {lastLandmark ?? 'none'}
        </p>
        <p className="text-sm font-medium" role="status" data-lab="hit">
          Under the pointer: {hovered ?? 'nothing'} · last tapped: {tapped ?? 'nothing'}
        </p>

        <fieldset className="grid gap-2">
          <legend className="text-sm mb-1 font-bold">Growth stage</legend>
          <div className="grid grid-cols-4 gap-2">
            {STAGES.map((stage) => (
              <button
                key={stage.id}
                type="button"
                data-stage={stage.id}
                className={cn(labButton, 'text-sm bg-white px-1')}
                onClick={() => change({ growth: stage.growth })}
              >
                {stage.label}
              </button>
            ))}
          </div>
        </fieldset>
        <fieldset className="grid gap-2">
          <legend className="text-sm mb-1 font-bold">Vitality and time of day</legend>
          <div className="grid grid-cols-3 gap-2">
            {VITALITIES.map((item) => (
              <button
                key={item.id}
                type="button"
                data-vitality={item.id}
                className={cn(labButton, 'text-sm bg-white px-1')}
                onClick={() => change({ vitality: item.vitality })}
              >
                {item.label}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-4 gap-2">
            {HOURS.map((item) => (
              <button
                key={item.label}
                type="button"
                className={cn(labButton, 'text-sm bg-white px-1')}
                onClick={() => change({ hour: item.hour })}
              >
                {item.label}
              </button>
            ))}
          </div>
        </fieldset>

        <div className="grid gap-2">
          <label className="text-sm flex min-h-11 items-center gap-2 font-bold">
            <input
              type="checkbox"
              className="size-5 accent-green"
              checked={lab.preview >= 0}
              onChange={(event) => change({ preview: event.target.checked ? lab.growth : -1 })}
            />
            Preview override (stage `preview.growth`)
          </label>
          {lab.preview >= 0 && (
            <Slider
              label="Preview growth"
              value={lab.preview}
              min={0}
              max={1}
              step={0.001}
              digits={3}
              onChange={(value) => change({ preview: value })}
            />
          )}
        </div>

        <Choice
          label="Species"
          value={lab.species}
          options={SPECIES}
          onChange={(species) => change({ species })}
        />
        <Slider
          label="Growth"
          value={lab.growth}
          min={0}
          max={1}
          step={0.001}
          digits={3}
          onChange={(growth) => change({ growth })}
        />
        <Slider
          label="Vitality"
          value={lab.vitality}
          min={0}
          max={1}
          step={0.01}
          digits={2}
          onChange={(vitality) => change({ vitality })}
        />
        <Slider
          label="Hour"
          value={lab.hour}
          min={0}
          max={24}
          step={0.25}
          digits={2}
          onChange={(hour) => change({ hour })}
        />
        <div className="grid grid-cols-2 gap-3">
          <Field label="Age (days)">
            {(id) => (
              <input
                id={id}
                type="number"
                min={0}
                value={lab.age}
                className={fieldClass}
                onChange={(event) => change({ age: Math.max(0, Number(event.target.value) || 0) })}
              />
            )}
          </Field>
          <Field label="Seed">
            {(id) => (
              <input
                id={id}
                type="number"
                min={0}
                value={lab.seed}
                className={fieldClass}
                onChange={(event) =>
                  change({ seed: Math.max(0, Math.round(Number(event.target.value) || 0)) })
                }
              />
            )}
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Choice
            label="Stage mode"
            value={lab.mode}
            options={MODES}
            onChange={(mode) => change({ mode })}
          />
          <Choice
            label="Anchor"
            value={lab.anchor}
            options={ANCHORS}
            onChange={(anchor) => change({ anchor })}
          />
          <Choice label="Box" value={lab.box} options={BOXES} onChange={(box) => change({ box })} />
          <Choice
            label="Sky"
            value={lab.sky}
            options={SKIES}
            onChange={(next) => change({ sky: next })}
          />
          <Choice
            label="Quality"
            value={lab.quality}
            options={QUALITIES}
            onChange={(quality) => change({ quality })}
          />
          <Choice
            label="Motion"
            value={lab.motion}
            options={MOTIONS}
            onChange={(motion) => change({ motion })}
          />
        </div>
        <Slider
          label="Fit"
          value={lab.fit}
          min={0.2}
          max={1}
          step={0.01}
          digits={2}
          onChange={(fit) => change({ fit })}
        />

        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            aria-pressed={lab.second}
            data-lab="second"
            className={cn(labButton, 'bg-yellow')}
            onClick={() => change({ second: !lab.second })}
          >
            {lab.second ? 'Remove 2nd stage' : 'Mount 2nd stage'}
          </button>
          <button
            type="button"
            aria-pressed={lab.tall}
            data-lab="tall"
            className={cn(labButton, 'bg-blue')}
            onClick={() => change({ tall: !lab.tall })}
          >
            {lab.tall ? 'Short page' : 'Tall page'}
          </button>
        </div>

        <CapturePreview auto={lab.capture} />

        <fieldset className="grid gap-2">
          <legend className="text-sm mb-1 font-bold">Island props (unlocked)</legend>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              data-lab="props-all"
              className={cn(labButton, 'text-sm bg-white')}
              onClick={() => change({ props: [...ISLAND_PROPS] })}
            >
              All
            </button>
            <button
              type="button"
              data-lab="props-none"
              className={cn(labButton, 'text-sm bg-white')}
              onClick={() => change({ props: [] })}
            >
              None
            </button>
          </div>
          <div className="grid grid-cols-2 gap-x-3">
            {ISLAND_PROPS.map((prop) => (
              <label key={prop} className="text-sm flex min-h-11 items-center gap-2 font-medium">
                <input
                  type="checkbox"
                  className="size-5 accent-green"
                  checked={lab.props.includes(prop)}
                  onChange={(event) =>
                    change({
                      props: event.target.checked
                        ? [...lab.props, prop]
                        : lab.props.filter((id) => id !== prop),
                    })
                  }
                />
                {prop}
              </label>
            ))}
          </div>
        </fieldset>
      </aside>
    </main>
  );
}
