import * as THREE from 'three';
import { clamp01, smoothstep } from '@/lib/math';
import { mulberry32 } from '@/lib/rng';
import { ISLAND, LIFE, LOOSE_INK_PX, PUPPET_FPS, QUALITY, TONE } from '../config';
import {
  LANDMARKS,
  type IslandPropId,
  type LandmarkId,
  type Species,
  type WorldPulse,
  type WorldQuality,
} from '../contract';
import {
  ENVELOPE,
  ParticlePool,
  createTurn,
  setTurn,
  toScreenSpace,
  writeInstance,
} from '../particles';
import { buildProps, findHangPoints, type HangPoint, type PropsModel } from '../props/models';
import { SLOT, SLOT_COUNT, landmarkSlot, propSlot } from '../props/slots';
import { PulseScheduler, thump, type BurstKind, type Play } from '../pulses';
import type { WorldFrame } from '../tracker';
import { TREE_ORIGIN } from '../tree/island';
import type { Pose, Skeleton } from '../tree/types';
import { blobGeometry, chipGeometry, propsGeometry } from './geometry';
import type { GroveRig, Solid } from './GroveRig';
import { ORDER, createCastMaterial, type LayerOptions } from './materials';

/**
 * Everything on the Grove that is alive but is not the tree or the island: paper bits
 * thrown by pulses, creatures, ambient drift, and the props and landmark objects.
 *
 * Budget discipline: three instanced pools (chips, balls, motes) carry every loose bit
 * and every creature, and one merged mesh carries every prop. Nothing here allocates
 * per frame: pools are typed arrays, instance buffers are written in place.
 */

const TAU = Math.PI * 2;
/** Instances at the end of the chip and ball buffers that are kept for creatures. */
const CHIP_MOVERS = 30;
const BALL_MOVERS = 14;
const CONFETTI = [TONE.green, TONE.blue, TONE.yellow, TONE.pink, TONE.tomato] as const;
const WING_TONES = [TONE.pink, TONE.yellow, TONE.violet] as const;
/** Seconds of the arrival of a newly unlocked prop: appear, drop, land. */
const ARRIVE = { appear: 0.08, drop: 0.3, settle: 0.5 } as const;
const ARRIVE_HEIGHT = 1.2;
const NEVER = 1e6;

const frac = (value: number) => value - Math.floor(value);
/** Cheap deterministic hash of two numbers into 0..1. */
const hash = (a: number, b: number) => frac(Math.sin(a * 127.1 + b * 311.7) * 43758.5453);

interface InstancedPool {
  solid: Solid;
  pool: ParticlePool;
  matrices: Float32Array;
  tones: Float32Array;
  toneAttribute: THREE.InstancedBufferAttribute;
  capacity: number;
  /** Instances written last frame, to know when an upload can be skipped. */
  written: number;
}

export interface LifeView {
  /** Yaw and pitch of the island this frame. */
  yaw: number;
  pitch: number;
  /** Position of the sticker's origin in camera units and its scale (px per unit). */
  x: number;
  y: number;
  scale: number;
}

export class GroveLife {
  readonly scheduler = new PulseScheduler();
  readonly turn = createTurn();
  /** Per landmark: canvas x, canvas y (CSS px, y down) and facing (1 front .. -1 back, -9 absent). */
  readonly anchors = new Float32Array(LANDMARKS.length * 3);
  /** Where a logged action sticks: a point on the crown, in canvas CSS pixels. */
  readonly sticking = { x: 0, y: 0, valid: false };
  /** Solids whose outlines must be weighed with the sticker. */
  readonly solids: Solid[] = [];
  /** Extra sway while the leaves rustle after a tap. */
  rustle = 0;
  /** Squash of the tree from a tap ("boop"), added to the pulse squash. */
  boopSquash = 0;
  /** True while something is in motion that a reduced-motion session must still draw. */
  busy = false;

  private chips: InstancedPool | null = null;
  private balls: InstancedPool | null = null;
  private motes: InstancedPool | null = null;
  private props: Solid | null = null;
  private propsCast: THREE.Mesh | null = null;
  private propsCastMaterial: THREE.ShaderMaterial | null = null;
  private model: PropsModel | null = null;
  private propsKey = '';
  private quality: WorldQuality | null = null;
  private readonly random = mulberry32(20261006);
  private readonly point = [0, 0, 0];
  private readonly view: LifeView = { yaw: 0, pitch: 0, x: 0, y: 0, scale: 1 };
  /** Seconds since each slot arrived / was last wiggled. */
  private readonly arrived = new Float32Array(SLOT_COUNT).fill(NEVER);
  private readonly wiggled = new Float32Array(SLOT_COUNT).fill(NEVER);
  private readonly landed = new Uint8Array(SLOT_COUNT).fill(1);
  private known: Set<IslandPropId> | null = null;
  private landmarkShow = 1;
  private night = 0;
  private dusk = 0;
  private boopAt = NEVER;
  private nextLeaf = 12;
  private nextDrift = 2;
  private nextBlink = 3;
  private blinkAt = NEVER;
  private time = 0;
  private species: Species = 'oak';
  private growth = 0;
  private vitality = 1;

  constructor(private readonly rig: GroveRig) {}

  // --- Building ----------------------------------------------------------------------------

  private makePool(
    geometry: THREE.BufferGeometry,
    capacity: number,
    reserved: number,
    options: LayerOptions,
  ): InstancedPool {
    const solid = this.rig.addSolid(this.rig.root, geometry, options, capacity);
    const tones = new Float32Array(capacity * 3);
    const toneAttribute = new THREE.InstancedBufferAttribute(tones, 3);
    toneAttribute.setUsage(THREE.DynamicDrawUsage);
    geometry.setAttribute('aTone', toneAttribute);
    solid.setCount(0);
    this.solids.push(solid);
    return {
      solid,
      pool: new ParticlePool(Math.max(1, capacity - reserved)),
      matrices: solid.matrices?.array as Float32Array,
      tones,
      toneAttribute,
      capacity,
      written: 0,
    };
  }

  private disposePools(): void {
    for (const entry of [this.chips, this.balls, this.motes]) {
      if (entry) this.rig.removeSolid(entry.solid);
    }
    this.chips = null;
    this.balls = null;
    this.motes = null;
  }

  private disposeProps(): void {
    if (this.props) this.rig.removeSolid(this.props);
    this.propsCast?.removeFromParent();
    this.propsCastMaterial?.dispose();
    this.props = null;
    this.propsCast = null;
    this.propsCastMaterial = null;
    this.model = null;
    this.propsKey = '';
  }

  /** (Re)creates the instanced pools for a quality tier. Bits in flight are dropped. */
  private build(quality: WorldQuality): void {
    this.disposePools();
    this.disposeProps();
    this.solids.length = 0;
    const budget = LIFE[quality];
    const tier = QUALITY[quality];
    this.chips = this.makePool(chipGeometry(), budget.chips, CHIP_MOVERS, {
      shade: 'facet',
      halftone: false,
      inkPx: LOOSE_INK_PX,
      sticker: false,
    });
    this.balls = this.makePool(blobGeometry(1), budget.balls, BALL_MOVERS, {
      shade: 'smooth',
      gloss: true,
      halftone: tier.halftone,
      inkPx: LOOSE_INK_PX,
      sticker: false,
    });
    // Fireflies and pollen: flat discs of light, no outline at all.
    this.motes = this.makePool(blobGeometry(0), budget.motes, budget.motes, {
      shade: 'facet',
      halftone: false,
      ink: 0,
      sticker: false,
    });
    this.quality = quality;
  }

  private ensureProps(
    seed: number,
    unlocked: readonly IslandPropId[],
    skeleton: Skeleton | null,
    pose: Pose | null,
    quality: WorldQuality,
  ): void {
    if (skeleton !== this.hangFor) {
      this.hangFor = skeleton;
      this.hang = findHangPoints(skeleton);
    }
    // A hung prop waits for its branch to grow out: the birdhouse stands on a post until
    // then, the swing only appears on a tree that can carry it (bible 5.6).
    const born = (point: HangPoint | null) =>
      point && pose && (pose.tipLength[point.branch] as number) >= point.along ? point : null;
    const house = born(this.hang.left);
    const seat = this.growth >= 0.55 ? born(this.hang.right) : null;
    const key = `${seed}|${skeleton?.species ?? '-'}|${[...unlocked].sort().join(',')}|${quality}|${house ? 1 : 0}${seat ? 1 : 0}`;
    if (key === this.propsKey && this.props) return;
    // Which props are new since the last build decides who gets an arrival.
    const before = this.known;
    const now = new Set(unlocked);
    this.disposeProps();
    const model = buildProps({
      seed,
      props: unlocked,
      skeleton,
      emblem: this.rig.emblemAt,
      hang: { birdhouse: house, swing: seat },
    });
    const tier = QUALITY[quality];
    const solid = this.rig.addSolid(this.rig.island, propsGeometry(model.data), {
      shade: 'smooth',
      normals: true,
      gloss: true,
      glossByMix: true,
      props: true,
      halftone: tier.halftone,
      ink: 0.75,
      // Props join the die-cut margin only where the tier can afford the extra passes.
      sticker: tier.woodSticker,
      keyline: tier.keyline,
    });
    this.props = solid;
    this.solids.push(solid);
    if (tier.castShadow) {
      const material = createCastMaterial(this.rig.uniforms, 'island');
      const cast = new THREE.Mesh(solid.geometry, material);
      cast.frustumCulled = false;
      cast.renderOrder = ORDER.cast;
      this.rig.island.add(cast);
      this.propsCast = cast;
      this.propsCastMaterial = material;
    }
    this.model = model;
    this.propsKey = key;
    this.rig.requestWeigh();
    for (const id of unlocked) {
      const slot = propSlot(id);
      if (before && !before.has(id)) {
        this.arrived[slot] = 0;
        this.landed[slot] = 0;
      }
    }
    this.known = now;
  }

  private hangFor: Skeleton | null = null;
  private hang: { left: HangPoint | null; right: HangPoint | null } = { left: null, right: null };

  // --- Pulses and taps ---------------------------------------------------------------------

  pulse(pulse: WorldPulse, now: number): void {
    this.scheduler.push(pulse, now);
  }

  /** Canvas CSS pixels (y down) to the sticker's screen-locked space. */
  private toLocal(canvasX: number, canvasY: number, canvas: { width: number; height: number }) {
    const { x, y, scale } = this.view;
    this.point[0] = (canvasX - canvas.width / 2 - x) / scale;
    this.point[1] = (canvas.height / 2 - canvasY - y) / scale;
    this.point[2] = 0;
  }

  /**
   * A tap at a canvas position. Props wiggle, the tree "boops" and sheds a few leaves.
   * Returns what was hit, so the caller can play the matching sound.
   */
  tap(
    canvasX: number,
    canvasY: number,
    canvas: { width: number; height: number },
  ): 'tree' | 'prop' | 'moss' | null {
    const { model, turn } = this;
    const pose = this.rig.pose;
    this.toLocal(canvasX, canvasY, canvas);
    const tx = this.point[0] as number;
    const ty = this.point[1] as number;
    const spot = [0, 0, 0];

    if (model && this.landmarkShow > 0.5) {
      let best = -1;
      let bestDistance = Number.POSITIVE_INFINITY;
      model.targets.forEach((target, index) => {
        toScreenSpace(turn, target.x, target.y, target.z, spot);
        const distance = Math.hypot((spot[0] as number) - tx, (spot[1] as number) - ty);
        if (distance < target.radius && distance < bestDistance) {
          best = index;
          bestDistance = distance;
        }
      });
      const hit = model.targets[best];
      if (hit) {
        this.wiggled[hit.slot] = 0;
        if (hit.slot === landmarkSlot('coach')) {
          this.scheduler.push({ kind: 'celebrate' }, this.time);
          return 'moss';
        }
        return 'prop';
      }
    }

    if (!pose || this.growth < 0.02) return null;
    let onTree = false;
    for (let i = 0; i < pose.clumpCount && !onTree; i += 1) {
      const m = pose.clumpMatrix;
      const radius = Math.hypot(
        m[i * 16] as number,
        m[i * 16 + 1] as number,
        m[i * 16 + 2] as number,
      );
      if (radius < 0.05) continue;
      toScreenSpace(
        turn,
        (m[i * 16 + 12] as number) + TREE_ORIGIN[0],
        (m[i * 16 + 13] as number) + TREE_ORIGIN[1],
        (m[i * 16 + 14] as number) + TREE_ORIGIN[2],
        spot,
      );
      onTree = Math.hypot((spot[0] as number) - tx, (spot[1] as number) - ty) < radius * 1.05;
    }
    if (!onTree) {
      toScreenSpace(turn, TREE_ORIGIN[0], TREE_ORIGIN[1], TREE_ORIGIN[2], spot);
      const reach = Math.max(0.16, pose.stats.trunkRadius * 1.4);
      const dy = ty - (spot[1] as number);
      onTree = Math.abs(tx - (spot[0] as number)) < reach && dy > -0.1 && dy < pose.stats.top * 0.9;
    }
    if (!onTree) return null;
    this.boopAt = 0;
    this.rustle = 1;
    this.burstLeaves(6, tx, ty, 0.55);
    return 'tree';
  }

  // --- Spawning ----------------------------------------------------------------------------

  private leafTone(): number {
    if (this.species === 'cherry' && this.growth >= 0.45) {
      return this.random() < 0.7 ? TONE.petal : TONE.canopyA;
    }
    return this.random() < 0.6 ? TONE.accent : TONE.canopyA;
  }

  /** A point on the surface of a living clump, in island space, written to `this.point`. */
  private clumpPoint(preferX = Number.NaN): boolean {
    const pose = this.rig.pose;
    if (!pose || pose.clumpCount === 0) return false;
    const m = pose.clumpMatrix;
    let index = Math.floor(this.random() * pose.clumpCount);
    if (!Number.isNaN(preferX)) {
      // Pick the living clump whose centre is nearest to a share of the crown's width.
      const half = Math.max(0.2, pose.stats.halfWidth);
      let best = Number.POSITIVE_INFINITY;
      for (let i = 0; i < pose.clumpCount; i += 1) {
        const offset = Math.abs((m[i * 16 + 12] as number) / half - preferX) + this.random() * 0.3;
        if (offset < best && (pose.clumpScale[i] as number) > 0.2) {
          best = offset;
          index = i;
        }
      }
    }
    for (let tries = 0; tries < 6 && (pose.clumpScale[index] as number) <= 0.2; tries += 1) {
      index = Math.floor(this.random() * pose.clumpCount);
    }
    const at = index * 16;
    const radius = Math.hypot(m[at] as number, m[at + 1] as number, m[at + 2] as number);
    if (radius < 0.03) return false;
    // Outward and upward, towards the viewer at the rest camera: where new leaves show.
    const azimuth = this.random() * TAU;
    const up = 0.15 + this.random() * 0.8;
    const flat = Math.sqrt(1 - up * up);
    this.point[0] =
      (m[at + 12] as number) + Math.cos(azimuth) * flat * radius * 0.92 + TREE_ORIGIN[0];
    this.point[1] = (m[at + 13] as number) + up * radius * 0.92 + TREE_ORIGIN[1];
    this.point[2] =
      (m[at + 14] as number) + Math.abs(Math.sin(azimuth)) * flat * radius * 0.92 + TREE_ORIGIN[2];
    return true;
  }

  /** Depth, in the screen-locked space, that is in front of the whole crown. */
  private front(): number {
    return (this.rig.pose?.stats.halfWidth ?? 0.6) + 0.7;
  }

  private crownCentre(): void {
    const pose = this.rig.pose;
    const top = pose ? pose.stats.top : 0.4;
    toScreenSpace(
      this.turn,
      TREE_ORIGIN[0],
      TREE_ORIGIN[1] + Math.max(0.3, top * 0.68),
      TREE_ORIGIN[2],
      this.point,
    );
  }

  private burstPops(count: number): void {
    const chips = this.chips?.pool;
    if (!chips) return;
    const tone = this.species === 'cherry' && this.growth >= 0.45 ? TONE.petal : TONE.accent;
    for (let cluster = 0; cluster < count; cluster += 1) {
      if (!this.clumpPoint()) {
        // A sprout has no crown yet: the new leaves pop at the tip of the shoot.
        const top = this.rig.pose?.stats.top ?? 0.2;
        this.point[0] = TREE_ORIGIN[0] + (this.random() - 0.5) * 0.12;
        this.point[1] = TREE_ORIGIN[1] + top * (0.7 + this.random() * 0.3);
        this.point[2] = TREE_ORIGIN[2] + 0.05;
      }
      const lean = (this.random() - 0.5) * 0.8;
      const size = 0.2 + this.random() * 0.1;
      for (let leaf = 0; leaf < 3; leaf += 1) {
        const i = chips.spawn();
        chips.anchored[i] = 1;
        chips.envelope[i] = ENVELOPE.pop;
        chips.x[i] = this.point[0] as number;
        chips.y[i] = this.point[1] as number;
        chips.z[i] = this.point[2] as number;
        chips.angle[i] = lean + (leaf - 1) * 0.75;
        chips.sx[i] = size * 0.5;
        chips.sy[i] = size * (leaf === 1 ? 1.15 : 0.95);
        chips.sz[i] = size * 0.5;
        // Nudge each leaf out along its own axis so the three fan from one point.
        chips.x[i] = (chips.x[i] as number) - Math.sin(chips.angle[i] as number) * size * 0.3;
        chips.y[i] = (chips.y[i] as number) + Math.cos(chips.angle[i] as number) * size * 0.3;
        chips.life[i] = 2.2 + this.random() * 0.8;
        // 28 ms stagger between clusters: the pop travels round the crown.
        chips.age[i] = -cluster * 0.028 - leaf * 0.012;
        chips.tone[i] = tone;
      }
    }
  }

  /** Loose leaves from a point of the screen-locked space, fluttering down-right. */
  private burstLeaves(count: number, x: number, y: number, power = 1): void {
    const chips = this.chips?.pool;
    if (!chips) return;
    for (let n = 0; n < count; n += 1) {
      const i = chips.spawn();
      const angle = Math.PI * (0.12 + this.random() * 0.76);
      const speed = (2.2 + this.random() * 2.6) * power;
      chips.x[i] = x + (this.random() - 0.5) * 0.2;
      chips.y[i] = y + (this.random() - 0.5) * 0.2;
      chips.z[i] = this.front() + this.random() * 0.6;
      chips.vx[i] = Math.cos(angle) * speed + 0.9;
      chips.vy[i] = Math.sin(angle) * speed;
      chips.gravity[i] = 5.5;
      chips.drag[i] = 1.9;
      chips.flutter[i] = 0.9 + this.random() * 0.9;
      chips.phase[i] = this.random();
      chips.angle[i] = this.random() * TAU;
      chips.spin[i] = (this.random() - 0.5) * 9;
      chips.flipRate[i] = 5 + this.random() * 7;
      const size = 0.15 + this.random() * 0.1;
      chips.sx[i] = size * 0.55;
      chips.sy[i] = size;
      chips.sz[i] = size * 0.5;
      chips.life[i] = 0.95 + this.random() * 0.5;
      chips.age[i] = -this.random() * 0.22;
      chips.tone[i] = this.leafTone();
    }
  }

  private burstConfetti(count: number): void {
    const chips = this.chips?.pool;
    if (!chips) return;
    this.crownCentre();
    const cx = this.point[0] as number;
    const cy = this.point[1] as number;
    for (let n = 0; n < count; n += 1) {
      const i = chips.spawn();
      // A fan over the upper half, evenly spread so it reads as a burst, not a clump.
      const angle = Math.PI * (0.08 + (0.84 * (n + this.random() * 0.8)) / count);
      const speed = 4.4 + this.random() * 3;
      chips.x[i] = cx;
      chips.y[i] = cy;
      // Behind the crown at first: the squares arc out from behind it.
      chips.z[i] = -this.front();
      chips.vx[i] = Math.cos(angle) * speed;
      chips.vy[i] = Math.sin(angle) * speed + 1.2;
      chips.gravity[i] = 10;
      chips.drag[i] = 1.3;
      chips.angle[i] = this.random() * TAU;
      chips.spin[i] = (this.random() - 0.5) * 14;
      chips.flipRate[i] = 8 + this.random() * 8;
      const size = 0.2 + this.random() * 0.07;
      chips.sx[i] = size;
      chips.sy[i] = size;
      chips.sz[i] = size * 0.4;
      chips.life[i] = 1.05 + this.random() * 0.35;
      chips.age[i] = -this.random() * 0.08;
      chips.tone[i] = CONFETTI[n % CONFETTI.length] as number;
    }
  }

  private burstDrops(count: number): void {
    const balls = this.balls?.pool;
    const model = this.model;
    if (!balls) return;
    const from = model
      ? model.can
      : ([TREE_ORIGIN[0] + 0.6, TREE_ORIGIN[1], TREE_ORIGIN[2]] as const);
    toScreenSpace(this.turn, from[0] - 0.42, from[1] + 0.34, from[2], this.point);
    for (let n = 0; n < count; n += 1) {
      const i = balls.spawn();
      balls.x[i] = (this.point[0] as number) + (this.random() - 0.5) * 0.08;
      balls.y[i] = this.point[1] as number;
      balls.z[i] = (this.point[2] as number) + 0.1;
      balls.vx[i] = -0.5 - this.random() * 0.4;
      balls.vy[i] = 0.4;
      balls.gravity[i] = 7;
      balls.sx[i] = 0.045;
      balls.sy[i] = 0.065;
      balls.sz[i] = 0.045;
      balls.life[i] = 0.42;
      balls.age[i] = -n * 0.08;
      balls.tone[i] = TONE.blue;
    }
  }

  /** Chips that puff outwards and shrink: dust round the base, soil where the seed lands. */
  private burstPuff(count: number, kind: 'dust' | 'soil' | 'paper', at?: readonly number[]): void {
    const pool = kind === 'soil' ? this.balls?.pool : this.chips?.pool;
    if (!pool) return;
    if (at) toScreenSpace(this.turn, at[0] as number, at[1] as number, at[2] as number, this.point);
    else if (kind === 'soil') {
      toScreenSpace(this.turn, TREE_ORIGIN[0], TREE_ORIGIN[1] + 0.04, TREE_ORIGIN[2], this.point);
    } else {
      toScreenSpace(this.turn, 0, -0.25, ISLAND.radius * 0.2, this.point);
    }
    const cx = this.point[0] as number;
    const cy = this.point[1] as number;
    const cz = this.point[2] as number;
    for (let n = 0; n < count; n += 1) {
      const i = pool.spawn();
      const angle = (n / count) * TAU + this.random() * 0.4;
      const wide = kind === 'dust' ? ISLAND.radius * 0.92 : 0.06;
      const speed = kind === 'dust' ? 1.4 : kind === 'soil' ? 1.9 : 2.6;
      pool.x[i] = cx + Math.cos(angle) * wide;
      pool.y[i] = cy + (kind === 'dust' ? Math.sin(angle) * wide * 0.22 : 0.02);
      pool.z[i] = cz + (kind === 'dust' ? Math.sin(angle) * 0.5 + 2 : 0.3);
      pool.vx[i] = Math.cos(angle) * speed;
      pool.vy[i] =
        kind === 'dust' ? 0.5 + this.random() * 0.4 : Math.abs(Math.sin(angle)) * speed + 1;
      pool.gravity[i] = kind === 'dust' ? 0.6 : 8;
      pool.drag[i] = kind === 'dust' ? 3.2 : 2.4;
      pool.angle[i] = this.random() * TAU;
      pool.spin[i] = (this.random() - 0.5) * 8;
      const size = kind === 'soil' ? 0.07 + this.random() * 0.04 : 0.16 + this.random() * 0.08;
      pool.sx[i] = size;
      pool.sy[i] = kind === 'soil' ? size * 0.8 : size * 0.7;
      pool.sz[i] = size * 0.6;
      pool.envelope[i] = ENVELOPE.puff;
      pool.life[i] = kind === 'dust' ? 0.58 : 0.5;
      pool.tone[i] = kind === 'soil' ? TONE.soil : kind === 'dust' ? TONE.paper : TONE.white;
    }
  }

  private burstFruit(count: number): void {
    const balls = this.balls?.pool;
    if (!balls) return;
    const tone =
      this.species === 'cherry' ? TONE.pink : this.species === 'pine' ? TONE.bark : TONE.kraftDark;
    for (let n = 0; n < count; n += 1) {
      const share = count > 1 ? n / (count - 1) : 0.5;
      if (!this.clumpPoint(share * 2 - 1)) continue;
      const i = balls.spawn();
      balls.anchored[i] = 1;
      balls.envelope[i] = ENVELOPE.pop;
      balls.x[i] = this.point[0] as number;
      balls.y[i] = this.point[1] as number;
      balls.z[i] = this.point[2] as number;
      const size = 0.085 + this.random() * 0.03;
      balls.sx[i] = size;
      balls.sy[i] = size * (this.species === 'cherry' ? 1 : 1.2);
      balls.sz[i] = size;
      balls.life[i] = 2.4 + this.random() * 0.6;
      // A wave from the viewer's left to the right, over 700 ms.
      balls.age[i] = -share * 0.6;
      balls.tone[i] = tone;
    }
  }

  private driftPetal(delay: number): void {
    const chips = this.chips?.pool;
    const pose = this.rig.pose;
    if (!chips || !pose) return;
    const half = Math.max(0.4, pose.stats.halfWidth);
    toScreenSpace(
      this.turn,
      TREE_ORIGIN[0] + (this.random() * 2 - 1) * half * 0.9,
      TREE_ORIGIN[1] + pose.stats.top * (0.55 + this.random() * 0.4),
      TREE_ORIGIN[2] + this.random() * half * 0.6,
      this.point,
    );
    const i = chips.spawn();
    chips.x[i] = this.point[0] as number;
    chips.y[i] = this.point[1] as number;
    chips.z[i] = this.front() + this.random() * 0.4;
    chips.vx[i] = 0.25 + this.random() * 0.3;
    chips.vy[i] = -0.3;
    chips.gravity[i] = 0.9;
    chips.drag[i] = 1.1;
    chips.flutter[i] = 0.7 + this.random() * 0.6;
    chips.phase[i] = this.random();
    chips.angle[i] = this.random() * TAU;
    chips.spin[i] = (this.random() - 0.5) * 3;
    chips.flipRate[i] = 2.5 + this.random() * 3;
    const size = 0.13 + this.random() * 0.06;
    chips.sx[i] = size * 0.6;
    chips.sy[i] = size;
    chips.sz[i] = size * 0.5;
    chips.life[i] = 2.8 + this.random() * 0.8;
    chips.age[i] = -delay;
    chips.tone[i] = this.leafTone();
  }

  private readonly onBurst = (kind: BurstKind, amount: number, _play: Play): void => {
    const share = this.quality ? LIFE[this.quality].burstShare : 1;
    const count = Math.max(1, Math.round(amount * share));
    switch (kind) {
      case 'pops':
        this.burstPops(count);
        break;
      case 'leaves': {
        const stick = this.stickingLocal();
        this.burstLeaves(count, stick[0], stick[1]);
        break;
      }
      case 'confetti':
        this.burstConfetti(count);
        break;
      case 'drops':
        this.burstDrops(amount);
        break;
      case 'dust':
        this.burstPuff(amount, 'dust');
        break;
      case 'soil':
        this.burstPuff(amount, 'soil');
        break;
      case 'fruit':
        this.burstFruit(count);
        break;
      case 'petals':
        for (let n = 0; n < count; n += 1) this.driftPetal((n / count) * 1.6);
        break;
    }
  };

  private readonly stick = [0, 0];

  /** The sticking point in the screen-locked space: on the crown, top-left of centre. */
  private stickingLocal(): number[] {
    const pose = this.rig.pose;
    const top = pose ? pose.stats.top : 0.3;
    const half = pose ? pose.stats.halfWidth : 0.1;
    const spot = [0, 0, 0];
    toScreenSpace(
      this.turn,
      TREE_ORIGIN[0],
      TREE_ORIGIN[1] + Math.max(0.2, top * 0.74),
      TREE_ORIGIN[2],
      spot,
    );
    this.stick[0] = (spot[0] as number) - half * 0.34;
    this.stick[1] = (spot[1] as number) + half * 0.12;
    return this.stick;
  }

  // --- Per frame ---------------------------------------------------------------------------

  /**
   * First half of a frame: advances the pulse scheduler so the rig can apply its
   * channels to this frame's transforms. Returns true while pulses are playing.
   */
  step(frame: WorldFrame, quality: WorldQuality): boolean {
    if (quality !== this.quality) this.build(quality);
    this.time = frame.time;
    const playing = this.scheduler.update(frame.time, frame.reducedMotion, this.onBurst);
    const dt = frame.dt;
    this.boopAt += dt;
    // "Boop": the tree squashes 6 % and springs back.
    this.boopSquash = this.boopAt < 0.7 ? 0.06 * thump(this.boopAt * 1000, 60, 95, 50) : 0;
    this.rustle = Math.max(0, this.rustle - dt * 1.6);
    return playing || this.boopAt < 0.7;
  }

  /**
   * Second half: the rig has placed the island for this frame. Simulates the bits,
   * poses the props and creatures and writes every instance buffer.
   */
  place(frame: WorldFrame, view: LifeView): void {
    const { rig } = this;
    const { snapshot, dt, reducedMotion: still } = frame;
    Object.assign(this.view, view);
    setTurn(this.turn, view.yaw, view.pitch);
    this.species = snapshot.species;
    this.growth = rig.shown.growth;
    this.vitality = rig.shown.vitality;
    const hour = rig.shown.hour;
    // Night 20:00 to 05:30, dusk from 17:30; both eased over forty minutes like the sky.
    this.night = hour >= 12 ? smoothstep(19.67, 20.33, hour) : 1 - smoothstep(5.17, 5.83, hour);
    this.dusk = hour >= 12 ? smoothstep(17.17, 17.83, hour) : 1 - smoothstep(5.17, 5.83, hour);
    const day = 1 - this.dusk;
    const quality = this.quality ?? 'medium';
    const ceremony = frame.mode === 'ceremony';

    this.ensureProps(snapshot.seed, snapshot.props, rig.skeleton, rig.pose, quality);
    const model = this.model;
    const channels = this.scheduler.channels;
    const puppetTime = still ? 2.4 : Math.floor(frame.time * PUPPET_FPS) / PUPPET_FPS;
    const gust =
      0.6 + 0.4 * Math.sin(frame.time * 0.31 + 1) * Math.sin(frame.time * 0.17 + 2.1) + this.rustle;

    // Landmark objects step aside for the ceremony and while there is only a seed.
    const wantLandmarks = ceremony || this.growth < 0.015 ? 0 : 1;
    this.landmarkShow = still
      ? wantLandmarks
      : this.landmarkShow + (wantLandmarks - this.landmarkShow) * Math.min(1, dt * 9);
    if (Math.abs(this.landmarkShow - wantLandmarks) < 0.002) this.landmarkShow = wantLandmarks;

    // --- Ambient drift (never under reduced motion, never in the ceremony) ---
    if (!still && !ceremony && frame.render) {
      this.nextDrift -= dt;
      this.nextLeaf -= dt;
      const blossoming = this.species === 'cherry' && this.growth >= 0.5;
      if (this.nextDrift <= 0) {
        this.nextDrift = blossoming ? 1.6 + this.random() * 1.6 : 0.9 + this.random() * 0.9;
        if (day > 0.5 && this.vitality > 0.6) {
          if (blossoming) this.driftPetal(0);
          else this.spawnPollen();
        }
      }
      if (this.nextLeaf <= 0) {
        // One leaf lets go every 20 to 40 seconds on a thriving tree.
        this.nextLeaf = 20 + this.random() * 20;
        if (this.vitality > 0.8 && this.growth > 0.2 && !blossoming) this.driftPetal(0);
      }
    }

    // --- Slots ---
    const slots = rig.uniforms.uSlot.value;
    const setSlot = (slot: number, scale: number, lift = 0, roll = 0, stretch = 0) => {
      slots[slot * 4] = scale;
      slots[slot * 4 + 1] = lift;
      slots[slot * 4 + 2] = roll;
      slots[slot * 4 + 3] = stretch;
    };
    let arriving = false;
    for (let slot = 1; slot < SLOT.blades; slot += 1) {
      const wiggle = (this.wiggled[slot] as number) + dt;
      this.wiggled[slot] = wiggle;
      let roll = wiggle < 0.9 ? 0.105 * Math.sin(wiggle * 24) * Math.exp(-wiggle * 5) : 0;
      let scale = 1;
      let lift = 0;
      const since = still ? NEVER : (this.arrived[slot] as number) + dt;
      this.arrived[slot] = since;
      if (since < ARRIVE.appear + ARRIVE.drop + ARRIVE.settle) {
        arriving = true;
        if (since < ARRIVE.appear) {
          scale = since / ARRIVE.appear;
          lift = ARRIVE_HEIGHT;
          roll -= 0.14;
        } else if (since < ARRIVE.appear + ARRIVE.drop) {
          const x = (since - ARRIVE.appear) / ARRIVE.drop;
          lift = ARRIVE_HEIGHT * (1 - x * x);
          roll -= 0.14 * (1 - x);
        } else {
          const rest = (since - ARRIVE.appear - ARRIVE.drop) * 1000;
          scale = 1 + 0.08 * Math.exp(-rest / 90) * Math.cos(rest / 55);
          if (!this.landed[slot]) {
            this.landed[slot] = 1;
            const target = model?.targets.find((entry) => entry.slot === slot);
            if (target) this.burstPuff(8, 'paper', [target.x, target.y, target.z]);
          }
        }
      }
      if (slot >= SLOT.landmarks) scale *= this.landmarkShow;
      setSlot(slot, scale, lift, roll);
    }
    if (wiggleActive(this.wiggled)) arriving = true;

    // The watering can tips towards the trunk; Moss bounces when it cheers.
    const can = landmarkSlot('log');
    slots[can * 4 + 2] = (slots[can * 4 + 2] as number) + channels.can * 0.62;
    const coach = landmarkSlot('coach');
    slots[coach * 4 + 1] = (slots[coach * 4 + 1] as number) + channels.cheer * 0.3;
    slots[coach * 4 + 3] = channels.cheer > 0 ? 0.1 * (channels.cheer - 0.35) : 0;

    // The passport tag hugs the trunk of the day and waits for a trunk to tie onto.
    const pose = rig.pose;
    if (model && pose) {
      const radius = pose.nodeRadius[model.tag.node] ?? 0;
      const tie = this.growth >= 0.1 && radius > 0.03 ? clamp01(radius / model.tag.radius) : 0;
      const me = landmarkSlot('me');
      slots[me * 4] = Math.max(tie > 0 ? 0.42 : 0, tie) * this.landmarkShow;
    }

    const spin = puppetTime * 2.4 * (0.7 + gust * 0.9);
    setSlot(SLOT.blades, 1, 0, -spin);
    const ripple = frac(puppetTime / 4) * 4;
    setSlot(SLOT.ripple, ripple < 0.25 ? 0.4 : ripple < 0.5 ? 0.7 : ripple < 0.75 ? 1 : 0);
    setSlot(SLOT.flowerHeads, 1 - 0.38 * this.night);
    setSlot(SLOT.steam, 1, 0.035 * Math.sin(puppetTime * 1.3), 0.06 * Math.sin(puppetTime * 0.9));
    setSlot(SLOT.lanternDisc, this.night > 0.5 ? 1 : 0);
    setSlot(SLOT.swingSeat, 1, 0, 0.105 * Math.sin(frame.time * 1.9) * (0.5 + gust * 0.5));
    setSlot(
      SLOT.mossSprout,
      1,
      0,
      0.12 * Math.sin(puppetTime * 0.8) + 0.5 * channels.cheer * Math.sin(frame.time * 30),
    );
    // Moss blinks every four to seven seconds.
    if (!still) {
      this.nextBlink -= dt;
      this.blinkAt += dt;
      if (this.nextBlink <= 0) {
        this.nextBlink = 4 + this.random() * 3;
        this.blinkAt = 0;
      }
    }
    setSlot(SLOT.mossEyes, 1, 0, 0, this.blinkAt < 0.13 ? -0.9 : 0);

    // --- Bits and creatures ---
    const simulate = !still && frame.render;
    if (this.chips)
      this.fill(this.chips, simulate ? dt : 0, (at) => this.chipMovers(at, puppetTime, day));
    if (this.balls) {
      this.fill(this.balls, simulate ? dt : 0, (at) =>
        this.ballMovers(at, puppetTime, day, channels),
      );
    }
    if (this.motes)
      this.fill(this.motes, simulate ? dt : 0, (at) => this.fireflies(at, puppetTime));

    // --- Anchors for the DOM ---
    this.project(frame);

    const live =
      (this.chips?.pool.live ?? 0) + (this.balls?.pool.live ?? 0) + (this.motes?.pool.live ?? 0);
    this.busy = arriving || live > 0 || this.blinkAt < 0.2;
  }

  private spawnPollen(): void {
    const motes = this.motes?.pool;
    if (!motes || motes.live >= 6) return;
    const i = motes.spawn();
    const size = 2.2 / Math.max(8, this.view.scale);
    motes.x[i] = -ISLAND.radius * (0.2 + this.random() * 0.9);
    motes.y[i] = 0.4 + this.random() * 2.6;
    motes.z[i] = this.front() + this.random();
    motes.vx[i] = 0.3 + this.random() * 0.25;
    motes.vy[i] = 0.05 + this.random() * 0.08;
    motes.flutter[i] = 0.12;
    motes.phase[i] = this.random();
    motes.sx[i] = size;
    motes.sy[i] = size;
    motes.sz[i] = size;
    motes.envelope[i] = ENVELOPE.chip;
    motes.life[i] = 5 + this.random() * 3;
    motes.tone[i] = TONE.spark;
  }

  /** Steps a pool, writes its bits, lets `movers` append creatures, uploads what changed. */
  private fill(entry: InstancedPool, dt: number, movers: (from: number) => number): void {
    entry.pool.step(dt);
    const afterBits = entry.pool.write(entry.matrices, entry.tones, 0, this.turn);
    const count = Math.min(entry.capacity, movers(afterBits));
    if (count === 0 && entry.written === 0) return;
    entry.written = count;
    entry.solid.setCount(count);
    if (entry.solid.matrices) entry.solid.matrices.needsUpdate = true;
    entry.toneAttribute.needsUpdate = true;
  }

  /** Writes an island-space instance into a pool's buffers. */
  private put(
    entry: InstancedPool,
    slot: number,
    x: number,
    y: number,
    z: number,
    sx: number,
    sy: number,
    sz: number,
    angle: number,
    tone: number,
    dx = 0,
    dy = 0,
  ): number {
    if (slot >= entry.capacity) return slot;
    toScreenSpace(this.turn, x, y, z, this.point);
    writeInstance(
      entry.matrices,
      entry.tones,
      slot,
      (this.point[0] as number) + dx,
      (this.point[1] as number) + dy,
      this.point[2] as number,
      sx,
      sy,
      sz,
      angle,
      tone,
    );
    return slot + 1;
  }

  private chipMovers(from: number, t: number, day: number): number {
    const chips = this.chips;
    const { model, rig } = this;
    if (!chips || !model) return from;
    const has = (id: IslandPropId) => Boolean(this.known?.has(id));
    const creatures = this.quality ? LIFE[this.quality].creatures : false;
    let at = from;
    const awake = day > 0.5 ? 1 : 0;

    // Birds: one perched on the crown, one circling. Absent at night.
    if (has('birds') && awake && rig.pose && this.growth > 0.08) {
      const top = rig.pose.stats.top;
      const flap = Math.sin(t * 9);
      const circle = t * 0.55;
      const radius = Math.max(2.2, rig.pose.stats.halfWidth + 1.1);
      const bx = TREE_ORIGIN[0] + Math.cos(circle) * radius;
      const by = TREE_ORIGIN[1] + top * 0.82 + Math.sin(t * 0.7) * 0.25 + 0.3;
      const bz = TREE_ORIGIN[2] + Math.sin(circle) * radius;
      // Screen-space heading of the circling bird: the beak leads.
      const heading = -Math.sin(circle) * this.turn.cosYaw + Math.cos(circle) * this.turn.sinYaw;
      const lead = heading >= 0 ? 1 : -1;
      at = this.put(chips, at, bx, by, bz, 0.3, 0.13, 0.1, 0, TONE.blue);
      at = this.put(chips, at, bx, by, bz, 0.1, 0.07, 0.08, 0, TONE.yellow, lead * 0.18, 0.01);
      at = this.put(
        chips,
        at,
        bx,
        by,
        bz,
        0.16,
        0.26,
        0.06,
        lead * (0.5 + flap * 0.5),
        TONE.blue,
        -lead * 0.03,
        0.09 * flap,
      );
      at = this.put(
        chips,
        at,
        bx,
        by,
        bz,
        0.14,
        0.22,
        0.05,
        lead * (-0.3 + flap * 0.4),
        TONE.white,
        lead * 0.02,
        0.06 * flap,
      );
      // The perched one only bobs and looks about.
      const look = hash(Math.floor(t / 2.3), 3) > 0.5 ? 1 : -1;
      const px = TREE_ORIGIN[0] + rig.pose.stats.halfWidth * 0.12;
      const py = TREE_ORIGIN[1] + top + 0.05 + (hash(Math.floor(t * 3), 9) > 0.86 ? 0.03 : 0);
      at = this.put(chips, at, px, py, TREE_ORIGIN[2], 0.26, 0.17, 0.1, 0, TONE.blue);
      at = this.put(
        chips,
        at,
        px,
        py,
        TREE_ORIGIN[2],
        0.09,
        0.06,
        0.08,
        0,
        TONE.yellow,
        look * 0.15,
        0.02,
      );
      at = this.put(
        chips,
        at,
        px,
        py,
        TREE_ORIGIN[2],
        0.14,
        0.08,
        0.05,
        look * -0.4,
        TONE.white,
        -look * 0.06,
        -0.01,
      );
    }

    // Butterflies: figure-eights over the flowers, by day.
    if (creatures && has('butterflies') && awake) {
      for (let n = 0; n < 3; n += 1) {
        const w = t * (0.55 + n * 0.11) + n * 2.1;
        const x = model.meadow[0] + Math.sin(w) * (0.9 + n * 0.25);
        const z = model.meadow[2] + Math.sin(w * 2) * 0.35 - n * 0.15;
        const y = model.meadow[1] + 0.42 + 0.12 * Math.sin(w * 3.1 + n);
        const open = 0.35 + 0.65 * Math.abs(Math.sin(t * 7 + n * 1.7));
        const tone = WING_TONES[n] as number;
        at = this.put(chips, at, x, y, z, 0.1 * open, 0.15, 0.03, 0.35, tone, -0.04 * open, 0);
        at = this.put(chips, at, x, y, z, 0.1 * open, 0.15, 0.03, -0.35, tone, 0.04 * open, 0);
      }
    }

    // Bee stripes ride on the bee bodies (balls): written by `ballMovers`.
    return at;
  }

  private ballMovers(
    from: number,
    t: number,
    day: number,
    channels: PulseScheduler['channels'],
  ): number {
    const balls = this.balls;
    const { model, rig } = this;
    if (!balls) return from;
    let at = from;
    const creatures = this.quality ? LIFE[this.quality].creatures : false;

    // Bees: three dots orbiting the hive, by day.
    if (model?.hive && creatures && day > 0.5) {
      for (let n = 0; n < 3; n += 1) {
        const w = t * (2.1 + n * 0.5) + n * 2.2;
        const r = 0.28 + n * 0.07;
        at = this.put(
          balls,
          at,
          model.hive[0] + Math.cos(w) * r,
          model.hive[1] + 0.08 * Math.sin(w * 1.7 + n) + n * 0.05,
          model.hive[2] + Math.sin(w) * r * 0.7,
          0.045,
          0.034,
          0.034,
          0,
          n === 1 ? TONE.ink : TONE.yellow,
        );
      }
    }

    // `ring`: a paper band travels up the trunk from the base to the first fork.
    if (channels.band >= 0 && rig.pose && this.growth > 0.05) {
      const radius = Math.max(0.05, rig.pose.stats.trunkRadius);
      const fork = Math.max(0.25, Math.min(rig.pose.stats.top * 0.45, 2.2));
      const fade = 1 - smoothstep(0.85, 1, channels.band);
      at = this.put(
        balls,
        at,
        TREE_ORIGIN[0],
        TREE_ORIGIN[1] + 0.06 + channels.band * fork,
        TREE_ORIGIN[2],
        radius * 1.75 * (0.5 + 0.5 * fade),
        0.07 * fade,
        radius * 1.75,
        0,
        TONE.paper,
      );
    }

    // `plant`: the seed sticker drops on its thread, squashes on the soil and stays.
    if (channels.seed >= 0) {
      const fall = (1 - channels.seed) * 2.6;
      const squash = channels.seedSquash;
      at = this.put(
        balls,
        at,
        TREE_ORIGIN[0] + 0.02,
        TREE_ORIGIN[1] + 0.05 + fall,
        TREE_ORIGIN[2] + 0.06,
        0.1 * (1 + squash),
        0.13 * (1 - squash),
        0.1,
        0.32,
        TONE.seed,
      );
    }
    return at;
  }

  private fireflies(from: number, t: number): number {
    const motes = this.motes;
    if (!motes || this.dusk <= 0.02) return from;
    const pose = this.rig.pose;
    const wanted = this.known?.has('fireflies') ? motes.capacity - 8 : 4;
    // Dusk brings the first few; night brings them all.
    const count = Math.round(wanted * (0.3 * this.dusk + 0.7 * this.night));
    const top = pose ? pose.stats.top : 1;
    const half = pose ? Math.max(0.8, pose.stats.halfWidth) : 0.8;
    const size = 2.3 / Math.max(8, this.view.scale);
    let at = from;
    for (let n = 0; n < count; n += 1) {
      const a = hash(n, 1);
      const b = hash(n, 2);
      const c = hash(n, 3);
      // Each has its own blink, a few seconds long, stepped like the other puppets.
      const period = 3.1 + a * 2.6;
      const lit = frac(t / period + b) < 0.62;
      if (!lit) continue;
      // Half of them haunt the crown, half the lawn.
      const lawn = n % 2 === 1;
      const w = t * (0.16 + c * 0.14) + a * TAU;
      const radius = lawn ? ISLAND.radius * (0.35 + b * 0.5) : half * (0.5 + b * 0.7);
      const x = TREE_ORIGIN[0] + Math.cos(w + b * TAU) * radius;
      const z = TREE_ORIGIN[2] + Math.sin(w * 1.3 + c * TAU) * radius * 0.8 + (lawn ? 0.6 : 0);
      const y =
        TREE_ORIGIN[1] +
        (lawn ? 0.25 + c * 0.5 : top * (0.35 + c * 0.6)) +
        0.12 * Math.sin(w * 3 + n);
      const glow = size * (0.8 + 0.5 * c);
      at = this.put(motes, at, x, y, z, glow, glow, glow, 0, TONE.spark);
    }
    return at;
  }

  /** Projects the landmark anchors and the sticking point to canvas CSS pixels. */
  private project(frame: WorldFrame): void {
    const { model, turn, view } = this;
    const { width, height } = frame.canvas;
    const stick = this.stickingLocal();
    this.sticking.x = width / 2 + view.x + (stick[0] as number) * view.scale;
    this.sticking.y = height / 2 - view.y - (stick[1] as number) * view.scale;
    this.sticking.valid = true;
    const spot = [0, 0, 0];
    LANDMARKS.forEach((id: LandmarkId, index) => {
      const anchor = model?.anchors[id];
      const hidden =
        !anchor ||
        this.landmarkShow < 0.5 ||
        (id === 'me' && (this.rig.uniforms.uSlot.value[landmarkSlot('me') * 4] as number) < 0.2);
      if (!anchor || hidden) {
        this.anchors[index * 3 + 2] = -9;
        return;
      }
      toScreenSpace(turn, anchor[0], anchor[1], anchor[2], spot);
      this.anchors[index * 3] = width / 2 + view.x + (spot[0] as number) * view.scale;
      this.anchors[index * 3 + 1] = height / 2 - view.y - (spot[1] as number) * view.scale;
      // Facing: how far towards the viewer the anchor sits on the turned island.
      this.anchors[index * 3 + 2] =
        (-anchor[0] * turn.sinYaw + anchor[2] * turn.cosYaw) / ISLAND.radius;
    });
  }

  /** Night amount for the rig (lantern glass). */
  get lit(): boolean {
    return this.dusk > 0.5;
  }

  dispose(): void {
    this.disposePools();
    this.disposeProps();
    this.solids.length = 0;
    this.scheduler.clear();
    this.quality = null;
    this.known = null;
    this.arrived.fill(NEVER);
    this.wiggled.fill(NEVER);
    this.landed.fill(1);
  }
}

function wiggleActive(wiggled: Float32Array): boolean {
  for (let i = 0; i < wiggled.length; i += 1) if ((wiggled[i] as number) < 0.9) return true;
  return false;
}
