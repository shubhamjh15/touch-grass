'use client';

import { useEffect, useId, useMemo, useRef, type CSSProperties, type ReactNode } from 'react';
import { clamp01 } from '@/lib/math';
import { multiplyRgb, rgbToHex, type Rgb } from './color';
import { CAMERA, INK, ISLAND, PAPER, SHADING, SUNDIAL, TONE } from './config';
import {
  LANDMARKS,
  type IslandPropId,
  type LandmarkId,
  type StageMode,
  type WorldSnapshot,
} from './contract';
import { lightAt, wrapHour } from './daylight';
import { fitSubject } from './framing';
import { layoutIsland, type Spot } from './props/layout';
import { createToneTable, resolveTones } from './tones';
import { subjectFrame } from './tree/frame';
import { generateTree } from './tree/generate';
import { TREE_ORIGIN, buildIsland, type IslandModel } from './tree/island';
import { createPose, poseTree } from './tree/pose';
import type { Pose, Skeleton } from './tree/types';

/**
 * The illustrated Grove: the same sticker as the 3D scene, drawn as SVG (bible 5.11).
 * It is what a stage shows before the 3D chunk has loaded and what no-WebGL users keep.
 *
 * It is not a separate drawing. The same seeded skeleton is generated, posed at the same
 * growth and projected with the same orthographic camera and the same framing maths, so
 * the 3D scene cross-fades in on top of it without a jump. Paint follows the same four
 * printed steps: base, a band of halftone dots, shade, one gloss oval.
 *
 * Sticker stack: every shape is defined once, with its colours behind CSS variables.
 * The group is then drawn four times: three flat silhouettes (hard shadow, kiss-cut
 * line, white die-cut margin: the union of everything, like the 3D union passes) and
 * once in colour.
 */

export interface FallbackTreeProps {
  snapshot: WorldSnapshot;
  /** Size of the stage box in CSS pixels. Nothing is drawn until it is known. */
  width: number;
  height: number;
  mode?: StageMode;
  /** Share of the width the lawn takes, and where the island stands (as `WorldStage`). */
  fit?: number;
  anchor?: 'center' | 'bottom';
  /** Draw the landmark objects (always on, like the 3D scene, except in a ceremony). */
  landmarks?: boolean;
  /** Reports where a logged action sticks, in pixels of the box. */
  onPlaced?: (stick: { x: number; y: number }) => void;
  className?: string;
}

const skeletons = new Map<string, { skeleton: Skeleton; pose: Pose }>();
function treeFor(seed: number, species: WorldSnapshot['species']) {
  const key = `${seed}:${species}`;
  let entry = skeletons.get(key);
  if (!entry) {
    const skeleton = generateTree(seed, species);
    entry = { skeleton, pose: createPose(skeleton) };
    if (skeletons.size > 6) skeletons.clear();
    skeletons.set(key, entry);
  }
  return entry;
}

const islands = new Map<number, IslandModel>();
function islandFor(seed: number): IslandModel {
  let model = islands.get(seed);
  if (!model) {
    model = buildIsland(seed, 12, 0.6);
    if (islands.size > 6) islands.clear();
    islands.set(seed, model);
  }
  return model;
}

const TAU = Math.PI * 2;
const f = (value: number) => value.toFixed(1);

interface Painter {
  /** Island space to pixels of the box. */
  px: (x: number, y: number, z: number) => [number, number];
  scale: number;
  sin: number;
  cos: number;
  ink: number;
  /** Graded hex of a tone step. */
  lit: (tone: number) => string;
  shade: (tone: number) => string;
  gloss: (tone: number) => string;
  dots: (tone: number) => string;
  uid: string;
}

/** A filled shape whose colours give way to the flat silhouette colour of a sticker pass. */
function paint(fill: string, ink: number): CSSProperties {
  return {
    fill: `var(--sil, ${fill})`,
    stroke: ink > 0 ? `var(--sil, ${INK})` : 'var(--sil, none)',
    strokeWidth: `calc(var(--sw, 0px) + ${ink > 0 ? (ink * 2).toFixed(2) : 0}px)`,
    paintOrder: 'stroke',
    strokeLinejoin: 'round',
  };
}

/** Flat overlays (shade, dots, gloss) never widen the silhouette. */
const overlay = (fill: string): CSSProperties => ({ fill: `var(--sil, ${fill})` });

/** The right-hand shade of an upright solid: a band of printed dots, then the shade tone. */
function sideShade(
  p: Painter,
  key: string,
  d: string,
  tone: number,
  left: number,
  right: number,
  top: number,
  bottom: number,
): ReactNode {
  const width = right - left;
  const band = left + width * 0.6;
  const dark = left + width * 0.74;
  const id = `${p.uid}-c-${key}`;
  return (
    <g key={`shade-${key}`}>
      <clipPath id={id}>
        <path d={d} />
      </clipPath>
      <g clipPath={`url(#${id})`}>
        <rect
          x={f(band)}
          y={f(top)}
          width={f(right - band + 2)}
          height={f(bottom - top)}
          style={overlay(p.dots(tone))}
        />
        <rect
          x={f(dark)}
          y={f(top)}
          width={f(right - dark + 2)}
          height={f(bottom - top)}
          style={overlay(p.shade(tone))}
        />
      </g>
    </g>
  );
}

/** A drum seen from the rest camera: its top disc and the wall down to its bottom rim. */
function drumPath(cx: number, top: number, bottom: number, rx: number, ry: number): string {
  return `M${f(cx - rx)} ${f(top)}A${f(rx)} ${f(ry)} 0 0 1 ${f(cx + rx)} ${f(top)}L${f(cx + rx)} ${f(bottom)}A${f(rx)} ${f(ry)} 0 0 1 ${f(cx - rx)} ${f(bottom)}Z`;
}

function drawIsland(p: Painter, model: IslandModel, ageDays: number): ReactNode[] {
  const out: ReactNode[] = [];
  const R = ISLAND.radius;
  // Terraces from the lowest up, so each covers the top of the one below.
  let y = -ISLAND.lidThickness - ISLAND.slabThickness;
  const layers = ISLAND.strata.map(([share, thickness], index) => {
    const layer = { share, top: y, bottom: y - thickness, index };
    y -= thickness;
    return layer;
  });
  for (const layer of [...layers].reverse()) {
    const tone = layer.index % 2 === 0 ? TONE.kraftA : TONE.kraftB;
    const [cx, top] = p.px(0, layer.top, 0);
    const [, bottom] = p.px(0, layer.bottom, 0);
    const rx = R * layer.share * p.scale;
    const ry = rx * p.sin;
    const d = drumPath(cx, top, bottom, rx, ry);
    out.push(<path key={`s${layer.index}`} d={d} style={paint(p.lit(tone), p.ink)} />);
    out.push(sideShade(p, `s${layer.index}`, d, tone, cx - rx, cx + rx, top - ry, bottom + ry));
  }

  // The grass slab and its lid.
  const [cx, slabTop] = p.px(0, -ISLAND.lidThickness, 0);
  const [, slabBottom] = p.px(0, -ISLAND.lidThickness - ISLAND.slabThickness, 0);
  const slabRx = (R - ISLAND.lidOverhang) * p.scale;
  const slab = drumPath(cx, slabTop, slabBottom, slabRx, slabRx * p.sin);
  out.push(<path key="slab" d={slab} style={paint(p.lit(TONE.grassSide), p.ink)} />);
  out.push(
    sideShade(
      p,
      'slab',
      slab,
      TONE.grassSide,
      cx - slabRx,
      cx + slabRx,
      slabTop - slabRx,
      slabBottom + slabRx,
    ),
  );
  const [, lidTop] = p.px(0, 0, 0);
  const rx = R * p.scale;
  const ry = rx * p.sin;
  out.push(
    <path
      key="lid"
      d={drumPath(cx, lidTop, slabTop, rx, ry)}
      style={paint(p.lit(TONE.grassTop), p.ink)}
    />,
  );
  out.push(
    <ellipse
      key="patch"
      cx={f(cx)}
      cy={f(lidTop)}
      rx={f(rx * ISLAND.patch)}
      ry={f(ry * ISLAND.patch)}
      style={overlay(p.lit(TONE.grassPatch))}
    />,
  );

  // Ring medallion on the top terrace: one ink ring per milestone of days.
  const [ex, ey] = p.px(...model.emblem.position);
  const ew = model.emblem.width * p.scale;
  const eh = model.emblem.height * p.scale * p.cos;
  const rings = ISLAND.emblem.rings.filter((days) => ageDays >= days).length;
  out.push(
    <ellipse
      key="plaque"
      cx={f(ex)}
      cy={f(ey)}
      rx={f(ew)}
      ry={f(eh)}
      style={paint(p.lit(TONE.plaque), p.ink * 0.75)}
    />,
  );
  for (let ring = 1; ring <= rings; ring += 1) {
    const share = ring / (rings + 0.6);
    out.push(
      <ellipse
        key={`ring${ring}`}
        cx={f(ex)}
        cy={f(ey)}
        rx={f(ew * share * 0.86)}
        ry={f(eh * share * 0.86)}
        fill="none"
        style={{ stroke: `var(--sil, ${INK})`, strokeWidth: Math.max(1, p.ink * 0.45) }}
      />,
    );
  }
  return out;
}

/** Things printed on the lawn: the sundial shadow, the hour ticks, the soil and the tufts. */
function drawLawn(
  p: Painter,
  model: IslandModel,
  hour: number,
  reach: number,
  growth: number,
): ReactNode[] {
  const out: ReactNode[] = [];
  const R = ISLAND.radius;
  const light = lightAt(hour);
  if (light.castShadow > 0.5 && growth > 0.06 && reach > 0.15) {
    // The shadow of the crown, thrown away from the sun and flattened onto the grass.
    const flat = Math.hypot(light.sun[0], light.sun[2]) || 1;
    const length = Math.min(R * 0.55, (reach * 1.1 * flat) / Math.max(0.2, light.sun[1]));
    const x = TREE_ORIGIN[0] - (light.sun[0] / flat) * length * 0.6;
    const z = TREE_ORIGIN[2] - (light.sun[2] / flat) * length * 0.6;
    const [sx, sy] = p.px(x, 0.01, z);
    const clip = `${p.uid}-lawn`;
    const [cx, cy] = p.px(0, 0, 0);
    out.push(
      <g key="cast">
        <clipPath id={clip}>
          <ellipse
            cx={f(cx)}
            cy={f(cy)}
            rx={f((R - 0.12) * p.scale)}
            ry={f((R - 0.12) * p.scale * p.sin)}
          />
        </clipPath>
        <ellipse
          clipPath={`url(#${clip})`}
          cx={f(sx)}
          cy={f(sy)}
          rx={f(Math.max(reach * 0.78, length * 0.62) * p.scale)}
          ry={f(Math.max(reach * 0.78, length * 0.62) * p.scale * p.sin)}
          style={overlay(p.shade(TONE.grassTop))}
        />
      </g>,
    );
  }

  const last = SUNDIAL.ticks - 1;
  for (let k = 0; k <= last; k += 1) {
    const angle = (k / last) * Math.PI;
    const outer = R * (1 - ISLAND.ticks.inset);
    const length = ISLAND.ticks.length * (k * 2 === last ? 2 : 1);
    const [x1, y1] = p.px(Math.cos(angle) * outer, 0, Math.sin(angle) * outer);
    const [x2, y2] = p.px(
      Math.cos(angle) * (outer - length),
      0,
      Math.sin(angle) * (outer - length),
    );
    out.push(
      <line
        key={`tick${k}`}
        x1={f(x1)}
        y1={f(y1)}
        x2={f(x2)}
        y2={f(y2)}
        style={{ stroke: `var(--sil, ${INK})`, strokeWidth: Math.max(1, p.ink * 0.5) }}
      />,
    );
  }

  const [mx, my] = p.px(TREE_ORIGIN[0], 0.02, TREE_ORIGIN[2]);
  const mound = ISLAND.mound.radius * p.scale;
  out.push(
    <path
      key="mound"
      d={`M${f(mx - mound)} ${f(my)}A${f(mound)} ${f(mound * 0.42)} 0 0 1 ${f(mx + mound)} ${f(my)}A${f(mound)} ${f(mound * p.sin)} 0 0 1 ${f(mx - mound)} ${f(my)}Z`}
      style={paint(p.lit(TONE.soil), p.ink * 0.75)}
    />,
  );

  model.tufts.forEach((tuft, index) => {
    const [tx, ty] = p.px(...tuft.position);
    const h = tuft.scale[1] * p.scale * 1.05;
    const w = tuft.scale[0] * p.scale;
    out.push(
      <path
        key={`tuft${index}`}
        d={`M${f(tx - w * 0.5)} ${f(ty)}L${f(tx - w * 0.62)} ${f(ty - h * 0.7)}L${f(tx - w * 0.14)} ${f(ty - h * 0.2)}L${f(tx)} ${f(ty - h)}L${f(tx + w * 0.16)} ${f(ty - h * 0.2)}L${f(tx + w * 0.6)} ${f(ty - h * 0.66)}L${f(tx + w * 0.5)} ${f(ty)}Z`}
        style={paint(p.lit(TONE.grassSide), p.ink * 0.5)}
      />,
    );
  });
  return out;
}

function drawWood(p: Painter, skeleton: Skeleton, pose: Pose): ReactNode[] {
  const out: ReactNode[] = [];
  const ox = TREE_ORIGIN[0];
  const oy = TREE_ORIGIN[1];
  const oz = TREE_ORIGIN[2];
  skeleton.branches.forEach((branch, index) => {
    if ((pose.tipLength[index] as number) <= 0) return;
    const left: string[] = [];
    const right: string[] = [];
    let previous: [number, number] | null = null;
    let minX = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;
    for (let n = 0; n < branch.nodeCount; n += 1) {
      const node = branch.nodeStart + n;
      const radius = (pose.nodeRadius[node] as number) * p.scale;
      const point = p.px(
        (pose.nodePosition[node * 3] as number) + ox,
        (pose.nodePosition[node * 3 + 1] as number) + oy,
        (pose.nodePosition[node * 3 + 2] as number) + oz,
      );
      const next =
        n + 1 < branch.nodeCount
          ? p.px(
              (pose.nodePosition[(node + 1) * 3] as number) + ox,
              (pose.nodePosition[(node + 1) * 3 + 1] as number) + oy,
              (pose.nodePosition[(node + 1) * 3 + 2] as number) + oz,
            )
          : point;
      const from = previous ?? point;
      let dx = next[0] - from[0];
      let dy = next[1] - from[1];
      const length = Math.hypot(dx, dy);
      if (length < 1e-4) {
        dx = 0;
        dy = -1;
      } else {
        dx /= length;
        dy /= length;
      }
      left.push(`${f(point[0] + dy * radius)} ${f(point[1] - dx * radius)}`);
      right.push(`${f(point[0] - dy * radius)} ${f(point[1] + dx * radius)}`);
      minX = Math.min(minX, point[0] - radius);
      maxX = Math.max(maxX, point[0] + radius);
      minY = Math.min(minY, point[1] - radius);
      maxY = Math.max(maxY, point[1] + radius);
      previous = point;
      if (radius <= 0 && n > 0) break;
    }
    if (left.length < 2) return;
    const d = `M${left.join('L')}L${right.reverse().join('L')}Z`;
    out.push(<path key={`w${index}`} d={d} style={paint(p.lit(TONE.bark), p.ink)} />);
    // Only the trunk is wide enough for the printed shade to read.
    if (index === 0 && maxX - minX > p.ink * 3) {
      out.push(sideShade(p, 'trunk', d, TONE.bark, minX, maxX, minY, maxY));
    }
  });
  return out;
}

interface Blob {
  depth: number;
  node: ReactNode;
}

function drawCanopy(p: Painter, skeleton: Skeleton, pose: Pose, vitality: number): ReactNode[] {
  const blobs: Blob[] = [];
  const m = pose.clumpMatrix;
  const variants = [TONE.canopyA, TONE.canopyB, TONE.canopyC];
  const mix = (a: string, b: string, t: number) =>
    t <= 0 ? a : t >= 1 ? b : `color-mix(in oklab, ${b} ${(t * 100).toFixed(0)}%, ${a})`;
  for (let i = 0; i < pose.clumpCount; i += 1) {
    const clump = skeleton.clumps[i];
    if (!clump) continue;
    const at = i * 16;
    const rx = Math.hypot(m[at] as number, m[at + 1] as number, m[at + 2] as number) * p.scale;
    const ryWorld = Math.hypot(m[at + 4] as number, m[at + 5] as number, m[at + 6] as number);
    if (rx < 0.8) continue;
    const x = (m[at + 12] as number) + TREE_ORIGIN[0];
    const y = (m[at + 13] as number) + TREE_ORIGIN[1];
    const z = (m[at + 14] as number) + TREE_ORIGIN[2];
    const [cx, cy] = p.px(x, y, z);
    const tone = clump.alt ? TONE.canopyAlt : (variants[clump.variant % 3] as number);
    const from = clump.bloom <= 1 ? TONE.canopyAlt : tone;
    const bloom = pose.clumpBloom[i] as number;
    const base = mix(p.lit(from), p.lit(tone), bloom);
    const shade = mix(p.shade(from), p.shade(tone), bloom);
    const key = `b${i}`;

    if (skeleton.shape === 'tier') {
      // A conifer tier: a cone with a scalloped hem. Base at the clump origin, apex above.
      const height = ryWorld * p.scale * p.cos;
      const hem = rx * p.sin;
      const teeth = 9;
      const points: string[] = [`${f(cx)} ${f(cy - height)}`];
      for (let n = 0; n <= teeth * 2; n += 1) {
        const angle = Math.PI - (n / (teeth * 2)) * Math.PI;
        const r = n % 2 === 0 ? 1 : 0.8;
        points.push(
          `${f(cx + Math.cos(angle) * rx * r)} ${f(cy + Math.sin(angle) * hem * r - (n % 2 ? height * 0.1 : 0))}`,
        );
      }
      const d = `M${points.join('L')}Z`;
      blobs.push({
        depth: -y,
        node: (
          <g key={key}>
            <path d={d} style={paint(base, p.ink)} />
            {sideShade(p, key, d, tone, cx - rx, cx + rx, cy - height, cy + hem)}
          </g>
        ),
      });
      continue;
    }

    const ry = ryWorld * p.scale;
    const clip = `${p.uid}-c-${key}`;
    // Lit region = an ellipse nudged towards the lamp; what it leaves uncovered is in shade.
    const crescent = (shift: number) =>
      `M${f(cx - rx * 2)} ${f(cy - ry * 2)}h${f(rx * 4)}v${f(ry * 4)}h${f(-rx * 4)}ZM${f(cx - rx * shift - rx)} ${f(cy - ry * shift)}a${f(rx)} ${f(ry)} 0 1 0 ${f(rx * 2)} 0a${f(rx)} ${f(ry)} 0 1 0 ${f(-rx * 2)} 0Z`;
    blobs.push({
      depth: y * p.sin + z * p.cos,
      node: (
        <g key={key}>
          <ellipse cx={f(cx)} cy={f(cy)} rx={f(rx)} ry={f(ry)} style={paint(base, p.ink)} />
          <clipPath id={clip}>
            <ellipse cx={f(cx)} cy={f(cy)} rx={f(rx)} ry={f(ry)} />
          </clipPath>
          <g clipPath={`url(#${clip})`} fillRule="evenodd">
            <path d={crescent(0.34)} style={overlay(p.dots(tone))} />
            <path d={crescent(0.2)} style={overlay(shade)} />
          </g>
          {vitality > 0.25 && rx > 7 && (
            <ellipse
              cx={f(cx - rx * 0.4)}
              cy={f(cy - ry * 0.44)}
              rx={f(rx * 0.2)}
              ry={f(ry * 0.1)}
              transform={`rotate(-30 ${f(cx - rx * 0.4)} ${f(cy - ry * 0.44)})`}
              style={overlay(p.gloss(tone))}
            />
          )}
        </g>
      ),
    });
  }
  blobs.sort((a, b) => a.depth - b.depth);
  const out = blobs.map((blob) => blob.node);

  // A few die-cut leaves and blossoms break the silhouette, as in the 3D scene.
  const accents = pose.accentMatrix;
  let slot = 0;
  skeleton.accents.forEach((accent, index) => {
    const written = slot;
    slot += 1;
    if (written >= pose.accentCount) return;
    const at = written * 16;
    const size =
      Math.hypot(accents[at + 4] as number, accents[at + 5] as number, accents[at + 6] as number) *
      p.scale;
    if (size < 2.5 || accent.rank >= 0.6) return;
    const [ax, ay] = p.px(
      (accents[at + 12] as number) + TREE_ORIGIN[0],
      (accents[at + 13] as number) + TREE_ORIGIN[1],
      (accents[at + 14] as number) + TREE_ORIGIN[2],
    );
    const turn = (accent.roll * 180) / Math.PI + (accent.direction[0] > 0 ? 35 : -35);
    if (accent.kind === 'blossom') {
      const petals: string[] = [];
      for (let n = 0; n < 10; n += 1) {
        const angle = (n / 10) * TAU - Math.PI / 2;
        const r = size * (n % 2 === 0 ? 1 : 0.6);
        petals.push(`${f(ax + Math.cos(angle) * r)} ${f(ay + Math.sin(angle) * r)}`);
      }
      out.push(
        <g key={`a${index}`}>
          <path d={`M${petals.join('L')}Z`} style={paint(p.lit(TONE.petal), p.ink * 0.75)} />
          <circle cx={f(ax)} cy={f(ay)} r={f(size * 0.3)} style={overlay(p.lit(TONE.petalCore))} />
        </g>,
      );
      return;
    }
    const tone = accent.hideBelow < 0 ? TONE.canopyAlt : TONE.accent;
    out.push(
      <path
        key={`a${index}`}
        transform={`rotate(${f(turn)} ${f(ax)} ${f(ay)})`}
        d={`M${f(ax)} ${f(ay)}q${f(size * 0.55)} ${f(-size * 0.5)} 0 ${f(-size)}q${f(-size * 0.55)} ${f(size * 0.5)} 0 ${f(size)}Z`}
        style={paint(p.lit(tone), p.ink * 0.75)}
      />,
    );
  });
  return out;
}

// --- Props and landmark objects: flat groups at the same spots as the 3D models --------------

interface Glyph {
  /** A rectangle standing upright: horizontal offset, base height, width, height (world units). */
  rect: (dx: number, y: number, w: number, h: number, tone: number, key: string) => ReactNode;
  disc: (dx: number, y: number, r: number, tone: number, key: string, flat?: number) => ReactNode;
  poly: (points: ReadonlyArray<readonly [number, number]>, tone: number, key: string) => ReactNode;
}

function glyphAt(p: Painter, spot: { x: number; y: number; z: number }): Glyph {
  const [bx, by] = p.px(spot.x, spot.y, spot.z);
  const s = p.scale;
  const v = s * p.cos;
  const ink = p.ink * 0.75;
  return {
    rect: (dx, y, w, h, tone, key) => (
      <rect
        key={key}
        x={f(bx + (dx - w / 2) * s)}
        y={f(by - (y + h) * v)}
        width={f(w * s)}
        height={f(h * v)}
        style={paint(tone === TONE.ink ? INK : p.lit(tone), tone === TONE.ink ? 0 : ink)}
      />
    ),
    disc: (dx, y, r, tone, key, flat = 1) => (
      <ellipse
        key={key}
        cx={f(bx + dx * s)}
        cy={f(by - y * v)}
        rx={f(r * s)}
        ry={f(r * s * flat)}
        style={paint(tone === TONE.ink ? INK : p.lit(tone), tone === TONE.ink ? 0 : ink)}
      />
    ),
    poly: (points, tone, key) => (
      <path
        key={key}
        d={`M${points.map(([dx, y]) => `${f(bx + dx * s)} ${f(by - y * v)}`).join('L')}Z`}
        style={paint(tone === TONE.ink ? INK : p.lit(tone), tone === TONE.ink ? 0 : ink)}
      />
    ),
  };
}

type Draw = (g: Glyph, p: Painter) => ReactNode[];

const PROP_GLYPHS: Partial<Record<IslandPropId, Draw>> = {
  mushrooms: (g) => [
    g.rect(0, 0, 0.07, 0.12, TONE.paper, 's1'),
    g.poly(
      [
        [-0.13, 0.11],
        [0.13, 0.11],
        [0.09, 0.2],
        [0, 0.23],
        [-0.09, 0.2],
      ],
      TONE.tomato,
      'c1',
    ),
    g.rect(0.16, 0, 0.05, 0.08, TONE.paper, 's2'),
    g.poly(
      [
        [0.07, 0.08],
        [0.25, 0.08],
        [0.21, 0.15],
        [0.11, 0.15],
      ],
      TONE.tomato,
      'c2',
    ),
  ],
  pond: (g, p) => [
    g.disc(0, 0.02, 0.62, TONE.blue, 'w', p.sin * 0.66),
    g.disc(0.26, 0.0, 0.11, TONE.green, 'l', p.sin * 0.7),
  ],
  bench: (g) => [
    g.rect(-0.28, 0, 0.045, 0.42, TONE.ink, 'l1'),
    g.rect(0.28, 0, 0.045, 0.42, TONE.ink, 'l2'),
    g.rect(0, 0.3, 0.72, 0.11, TONE.bark, 'b'),
    g.rect(0, 0.18, 0.72, 0.06, TONE.bark, 's'),
  ],
  lantern: (g) => [
    g.rect(0, 0, 0.06, 0.46, TONE.bark, 'p'),
    g.rect(0, 0.46, 0.17, 0.17, TONE.glass, 'g'),
    g.poly(
      [
        [-0.13, 0.63],
        [0.13, 0.63],
        [0, 0.72],
      ],
      TONE.bark,
      'r',
    ),
  ],
  turbine: (g) => [
    g.poly(
      [
        [-0.075, 0],
        [0.075, 0],
        [0.04, 1.52],
        [-0.04, 1.52],
      ],
      TONE.white,
      't',
    ),
    ...[0, 1, 2].map((blade) => {
      const angle = 0.5 + (blade / 3) * TAU;
      const tip: [number, number] = [Math.sin(angle) * 0.62, 1.52 + Math.cos(angle) * 0.62];
      const side: [number, number] = [Math.cos(angle) * 0.05, -Math.sin(angle) * 0.05];
      return g.poly(
        [[-side[0], 1.52 - side[1]], [side[0], 1.52 + side[1]], tip],
        TONE.white,
        `b${blade}`,
      );
    }),
    g.disc(0, 1.52, 0.07, TONE.yellow, 'h'),
  ],
  solar: (g) => [
    g.rect(0, 0, 0.06, 0.3, TONE.bark, 'p'),
    g.poly(
      [
        [-0.3, 0.22],
        [0.3, 0.22],
        [0.26, 0.5],
        [-0.26, 0.5],
      ],
      TONE.blue,
      'n',
    ),
  ],
  compost: (g) => [
    g.rect(0, 0, 0.46, 0.32, TONE.kraftA, 'c'),
    g.rect(0, 0.1, 0.46, 0.03, TONE.ink, 's'),
    g.rect(0, 0.32, 0.54, 0.07, TONE.green, 'l'),
  ],
  'veggie-patch': (g) => [
    g.rect(0, 0, 0.9, 0.16, TONE.kraftDark, 'b'),
    ...[-0.29, 0, 0.29].map((x) =>
      g.poly(
        [
          [x - 0.06, 0.16],
          [x + 0.06, 0.16],
          [x, 0.36],
        ],
        TONE.green,
        `t${x}`,
      ),
    ),
  ],
  beehive: (g) => [
    g.rect(0, 0, 0.06, 0.22, TONE.bark, 'p'),
    g.poly(
      [
        [-0.16, 0.22],
        [0.16, 0.22],
        [0.19, 0.38],
        [0.13, 0.54],
        [0.04, 0.6],
        [-0.04, 0.6],
        [-0.13, 0.54],
        [-0.19, 0.38],
      ],
      TONE.yellow,
      'h',
    ),
    g.disc(0, 0.3, 0.04, TONE.ink, 'd'),
  ],
  birdhouse: (g) => [
    g.rect(0, 0, 0.06, 0.5, TONE.bark, 'p'),
    g.rect(0, 0.5, 0.24, 0.22, TONE.pink, 'h'),
    g.poly(
      [
        [-0.18, 0.7],
        [0.18, 0.7],
        [0, 0.87],
      ],
      TONE.yellow,
      'r',
    ),
    g.disc(0, 0.62, 0.045, TONE.ink, 'o'),
  ],
  signpost: (g) => [
    g.rect(0, 0, 0.07, 0.62, TONE.bark, 'p'),
    g.poly(
      [
        [-0.15, 0.4],
        [0.13, 0.4],
        [0.24, 0.47],
        [0.13, 0.54],
        [-0.15, 0.54],
      ],
      TONE.yellow,
      'a',
    ),
    g.poly(
      [
        [0.15, 0.22],
        [0.15, 0.35],
        [-0.12, 0.35],
        [-0.22, 0.285],
        [-0.12, 0.22],
      ],
      TONE.pink,
      'b',
    ),
  ],
};

const LANDMARK_GLYPHS: Partial<Record<LandmarkId, Draw>> = {
  log: (g) => [
    g.poly(
      [
        [-0.34, 0.3],
        [-0.3, 0.24],
        [-0.1, 0.12],
        [-0.1, 0.18],
      ],
      TONE.blue,
      's',
    ),
    g.rect(0, 0, 0.26, 0.22, TONE.blue, 'b'),
    g.rect(0.17, 0.05, 0.04, 0.17, TONE.blue, 'h'),
  ],
  quests: (g) => [
    g.rect(-0.23, 0, 0.05, 0.6, TONE.bark, 'p1'),
    g.rect(0.23, 0, 0.05, 0.6, TONE.bark, 'p2'),
    g.rect(0, 0.24, 0.6, 0.36, TONE.kraftA, 'b'),
    g.rect(-0.18, 0.35, 0.13, 0.17, TONE.yellow, 't1'),
    g.rect(0, 0.32, 0.13, 0.17, TONE.pink, 't2'),
    g.rect(0.18, 0.37, 0.13, 0.15, TONE.white, 't3'),
  ],
  learn: (g) => [
    g.rect(0, 0, 0.34, 0.07, TONE.blue, 'a'),
    g.rect(0.015, 0.07, 0.3, 0.07, TONE.pink, 'b'),
    g.poly(
      [
        [-0.16, 0.2],
        [0, 0.15],
        [0.16, 0.2],
        [0.16, 0.24],
        [0, 0.19],
        [-0.16, 0.24],
      ],
      TONE.yellow,
      'c',
    ),
  ],
  community: (g) => [
    g.rect(0, 0, 0.06, 0.36, TONE.bark, 'p'),
    g.rect(0, 0.36, 0.22, 0.2, TONE.pink, 'b'),
    g.rect(0.13, 0.44, 0.03, 0.17, TONE.yellow, 'f'),
  ],
  coach: (g) => [
    g.disc(0, 0.25, 0.27, TONE.moss, 'm', 0.92),
    g.disc(-0.095, 0.3, 0.055, TONE.white, 'e1'),
    g.disc(0.095, 0.3, 0.055, TONE.white, 'e2'),
    g.disc(-0.09, 0.295, 0.024, TONE.ink, 'p1'),
    g.disc(0.09, 0.295, 0.024, TONE.ink, 'p2'),
    g.poly(
      [
        [0, 0.48],
        [0.06, 0.57],
        [0.12, 0.63],
        [0.03, 0.62],
      ],
      TONE.lime,
      's',
    ),
  ],
};

function drawProps(
  p: Painter,
  seed: number,
  props: readonly IslandPropId[],
  showLandmarks: boolean,
  side: 'back' | 'front',
): ReactNode[] {
  const layout = layoutIsland(seed);
  const items: Array<{ z: number; node: ReactNode }> = [];
  const add = (key: string, spot: Spot, draw: Draw | undefined) => {
    if (!draw) return;
    const behind = spot.z < TREE_ORIGIN[2];
    if (behind !== (side === 'back')) return;
    items.push({ z: spot.z, node: <g key={key}>{draw(glyphAt(p, spot), p)}</g> });
  };
  for (const id of props) {
    if (id === 'flowers') {
      layout.flowers.forEach((spot, index) => {
        const tone = [TONE.pink, TONE.yellow, TONE.violet][index % 3] as number;
        add(`flower${index}`, spot, (g) => [
          g.rect(0, 0, 0.028, 0.24, TONE.ink, 's'),
          g.disc(0, 0.25, 0.085, tone, 'h'),
          g.disc(0, 0.25, 0.028, TONE.ink, 'c'),
        ]);
      });
      continue;
    }
    if (id === 'birds' || id === 'butterflies' || id === 'fireflies' || id === 'swing') continue;
    add(id, layout.spots[id], PROP_GLYPHS[id]);
  }
  if (showLandmarks) {
    for (const id of LANDMARKS) {
      if (id === 'impact' || id === 'me') continue;
      add(id, layout.spots[id], LANDMARK_GLYPHS[id]);
    }
  }
  items.sort((a, b) => a.z - b.z);
  return items.map((item) => item.node);
}

export function FallbackTree({
  snapshot,
  width,
  height,
  mode = 'companion',
  fit = 0.86,
  anchor = 'bottom',
  landmarks = true,
  onPlaced,
  className,
}: FallbackTreeProps) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const bobbing = useRef<SVGGElement>(null);
  const growth = clamp01(snapshot.growth);
  const vitality = clamp01(snapshot.vitality);
  const hour = wrapHour(snapshot.hour);
  const { seed, species, ageDays, props } = snapshot;
  const drawable = width >= 8 && height >= 8;

  const scene = useMemo(() => {
    if (!drawable) return null;
    const { skeleton, pose } = treeFor(seed, species);
    poseTree(skeleton, growth, pose, { vitality, ageDays, accentShare: 1 });
    const pitch = CAMERA.pitchByMode[mode];
    const bleed = mode === 'hero' || mode === 'hub';
    const placement = fitSubject({
      box: { x: 0, y: 0, width, height },
      canvas: { width, height },
      frame: subjectFrame(skeleton.metrics, growth, pitch),
      fit,
      anchor: anchor === 'bottom' ? 1 : 0,
      chrome: bleed ? Math.min(CAMERA.bleedChrome, height * 0.12) : 0,
    });
    const sin = Math.sin(pitch);
    const cos = Math.cos(pitch);
    const scale = placement.scale;
    const table = resolveTones(createToneTable(), species, vitality, growth);
    const light = lightAt(hour);
    const lanternLit = hour >= 17.5 || hour < 5.5;
    const hex = (source: Float32Array, tone: number) => {
      const from = tone === TONE.glass ? (lanternLit ? TONE.glow : TONE.yellow) : tone;
      const rgb: Rgb = [
        source[from * 3] as number,
        source[from * 3 + 1] as number,
        source[from * 3 + 2] as number,
      ];
      // Lit glass is emissive; everything else takes the time-of-day grade.
      return rgbToHex(from >= TONE.glow ? rgb : multiplyRgb(rgb, light.grade));
    };
    const painter: Painter = {
      px: (x, y, z) => [placement.left + x * scale, placement.top - (y * cos - z * sin) * scale],
      scale,
      sin,
      cos,
      ink: placement.sticker.ink,
      lit: (tone) => hex(table.lit, tone),
      shade: (tone) => hex(table.shade, tone),
      gloss: (tone) => hex(table.highlight, tone),
      dots: (tone) => `url(#${uid}-d-${tone})`,
      uid,
    };
    const island = islandFor(seed);
    const showLandmarks = landmarks && mode !== 'ceremony' && growth >= 0.015;
    const reach = pose.stats.halfWidth;
    const dotTones = [
      TONE.kraftA,
      TONE.kraftB,
      TONE.grassSide,
      TONE.bark,
      TONE.canopyA,
      TONE.canopyB,
      TONE.canopyC,
      TONE.canopyAlt,
    ];
    const pitchPx = Math.max(4, SHADING.dotPitchPx * Math.max(0.6, placement.sticker.ink / 4));
    const art = (
      <>
        {drawIsland(painter, island, ageDays)}
        {drawLawn(painter, island, hour, reach, growth)}
        {drawProps(painter, seed, props, showLandmarks, 'back')}
        {growth > 0.004 && drawWood(painter, skeleton, pose)}
        {growth > 0.004 && drawCanopy(painter, skeleton, pose, vitality)}
        {drawProps(painter, seed, props, showLandmarks, 'front')}
      </>
    );
    const defs = dotTones.map((tone) => (
      <pattern
        key={tone}
        id={`${uid}-d-${tone}`}
        width={pitchPx}
        height={pitchPx}
        patternUnits="userSpaceOnUse"
        patternTransform="rotate(30)"
      >
        <rect width={pitchPx} height={pitchPx} fill={hex(table.lit, tone)} />
        <circle
          cx={pitchPx / 2}
          cy={pitchPx / 2}
          r={(pitchPx * SHADING.dotRadiusPx) / SHADING.dotPitchPx}
          fill={hex(table.shade, tone)}
        />
      </pattern>
    ));
    const top = pose.stats.top;
    const stick = painter.px(
      TREE_ORIGIN[0] - reach * 0.34,
      TREE_ORIGIN[1] + Math.max(0.2, top * 0.74) + reach * 0.12,
      TREE_ORIGIN[2],
    );
    return { art, defs, placement, stick: { x: stick[0], y: stick[1] }, clumps: pose.clumpCount };
  }, [
    drawable,
    seed,
    species,
    growth,
    vitality,
    ageDays,
    hour,
    props,
    mode,
    fit,
    anchor,
    width,
    height,
    landmarks,
    uid,
  ]);

  const stickX = scene?.stick.x;
  const stickY = scene?.stick.y;
  useEffect(() => {
    if (stickX !== undefined && stickY !== undefined) onPlaced?.({ x: stickX, y: stickY });
  }, [stickX, stickY, onPlaced]);

  // A slow, stepped bob: the same breath as the 3D sticker. Off under reduced motion.
  useEffect(() => {
    const el = bobbing.current;
    if (!el || !scene || typeof el.animate !== 'function') return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const amount = Math.max(1, CAMERA.bob * scene.placement.scale);
    const bob = el.animate(
      [
        { transform: `translateY(${amount.toFixed(2)}px)` },
        { transform: `translateY(${(-amount).toFixed(2)}px)` },
      ],
      {
        duration: (CAMERA.bobPeriod / 2) * 1000,
        direction: 'alternate',
        iterations: Infinity,
        easing: `steps(${Math.round((CAMERA.bobPeriod / 2) * 12)}, end)`,
      },
    );
    return () => bob.cancel();
  }, [scene]);

  if (!scene) return null;
  const { sticker } = scene.placement;
  const margin = sticker.ink + sticker.margin;
  const cut = margin + sticker.keyline;
  const pass = (color: string, reach: number) =>
    ({ '--sil': color, '--sw': `${(reach * 2).toFixed(2)}px` }) as CSSProperties;

  return (
    <svg
      viewBox={`0 0 ${f(width)} ${f(height)}`}
      width={width}
      height={height}
      className={className}
      aria-hidden="true"
      focusable="false"
      data-world-fallback={species}
      data-clumps={scene.clumps}
    >
      <defs>
        {scene.defs}
        <g id={`${uid}-art`}>{scene.art}</g>
      </defs>
      <g ref={bobbing}>
        <use
          href={`#${uid}-art`}
          x={sticker.shadow}
          y={sticker.shadow}
          style={pass(INK, cut)}
          data-pass="shadow"
        />
        <use href={`#${uid}-art`} style={pass(INK, cut)} data-pass="keyline" />
        <use href={`#${uid}-art`} style={pass(PAPER, margin)} data-pass="margin" />
        <use href={`#${uid}-art`} data-pass="art" />
      </g>
    </svg>
  );
}
