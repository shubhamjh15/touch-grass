import * as THREE from 'three';
import { clamp01, damp, smoothstep } from '@/lib/math';
import { CAMERA, ISLAND, MOTION, QUALITY, SHADING, STICKER, TONE } from '../config';
import type { Species, WorldQuality } from '../contract';
import { hourDelta, lightAt, wrapHour } from '../daylight';
import { fitSubject, type Placement } from '../framing';
import { createToneTable, droopFor, glossFor, resolveTones, swayFor } from '../tones';
import type { WorldFrame } from '../tracker';
import { subjectFrame } from '../tree/frame';
import { generateTree } from '../tree/generate';
import { buildIsland, type ScatterItem } from '../tree/island';
import { createPose, poseTree } from '../tree/pose';
import type { Pose, Skeleton } from '../tree/types';
import { composeInto } from '../tree/vec';
import {
  blobGeometry,
  blossomGeometry,
  decalGeometry,
  emblemGeometry,
  leafGeometry,
  rockGeometry,
  soupGeometry,
  tierGeometry,
  tuftGeometry,
  woodGeometry,
  writeWood,
  type WoodMesh,
} from './geometry';
import {
  ORDER,
  PASS_ORDER,
  createCastMaterial,
  createLayer,
  createSharedUniforms,
  disposeLayer,
  layerPasses,
  weighLayer,
  type Layer,
  type LayerOptions,
} from './materials';

/** One solid of the Grove: a geometry drawn once per sticker pass. */
export interface Solid {
  layer: Layer;
  geometry: THREE.BufferGeometry;
  meshes: THREE.Mesh[];
  /** Shared by every pass of an instanced solid. */
  matrices: THREE.InstancedBufferAttribute | null;
  setCount: (count: number) => void;
}

/** Wind pose that is held when motion is reduced: a calm, slightly leaning moment. */
const STILL_TIME = 2.4;
const TAU = Math.PI * 2;

/**
 * The Grove itself: island, tree and their paint, as one three.js group.
 *
 * It knows nothing about React or the DOM. Each frame it receives the placement
 * computed by the tracker and the snapshot to show, eases what needs easing, re-poses
 * the tree only when the displayed growth changes, and updates a handful of uniforms.
 *
 * Seams for the next layer of work (pulses, props, particles, landmarks, capture) are
 * the public members: `root`, `spin`, `island`, `tree`, `uniforms`, `addSolid`,
 * `skeleton`, `pose`, `placement`, `shown` and `orbit`.
 */
export class GroveRig {
  /** Positioned and scaled in CSS pixels by the placement. Screen-locked things go here. */
  readonly root = new THREE.Group();
  /** Camera elevation. */
  readonly tilt = new THREE.Group();
  /** Turns with the island (idle turn, later the user's drag). Island-locked things go here. */
  readonly spin = new THREE.Group();
  readonly island = new THREE.Group();
  /** Origin at the foot of the trunk. Tree-locked things (bursts, fruit) go here. */
  readonly tree = new THREE.Group();
  readonly uniforms = createSharedUniforms();

  skeleton: Skeleton | null = null;
  pose: Pose | null = null;
  placement: Placement | null = null;
  /** Extra yaw on top of the idle turn, for the interaction layer to drive. */
  orbit = 0;
  /** Values currently on screen (the snapshot, eased). */
  readonly shown = {
    growth: 0,
    vitality: 1,
    hour: 12,
    pop: 0,
    pitch: CAMERA.pitch as number,
    yaw: 0,
  };

  private readonly tones = createToneTable();
  private islandSolids: Solid[] = [];
  private treeSolids: Solid[] = [];
  private casts: THREE.Mesh[] = [];
  private castMaterials: THREE.ShaderMaterial[] = [];
  private wood: WoodMesh | null = null;
  private clumps: Solid | null = null;
  private clumpTones: THREE.InstancedBufferAttribute | null = null;
  private leaves: Solid | null = null;
  private blossoms: Solid | null = null;
  /** For each drawn accent: 0 leaf / 1 blossom, and its slot within that kind. */
  private accentKind = new Uint8Array(0);
  private accentSlot = new Uint16Array(0);
  private quality: WorldQuality | null = null;
  private seed = Number.NaN;
  private species: Species | null = null;
  private started = false;
  private posed = { growth: -1, vitality: -1, pop: -1, age: -1 };
  private toned = { vitality: -1, growth: -1 };
  private lit = Number.NaN;
  private weighed = { ink: -1, margin: -1, shadow: -1, lift: -1 };
  private last = { x: Number.NaN, y: Number.NaN, scale: Number.NaN, width: 0, height: 0, yaw: 0 };

  constructor() {
    this.root.add(this.tilt);
    this.tilt.add(this.spin);
    this.spin.add(this.island, this.tree);
  }

  /**
   * Adds a solid drawn with the sticker passes. `capacity` makes it instanced; the
   * caller then fills `matrices` and calls `setCount`.
   */
  addSolid(
    parent: THREE.Object3D,
    geometry: THREE.BufferGeometry,
    options: LayerOptions,
    capacity = 0,
  ): Solid {
    const layer = createLayer(this.uniforms, options);
    this.weighed.ink = -1;
    const matrices =
      capacity > 0 ? new THREE.InstancedBufferAttribute(new Float32Array(capacity * 16), 16) : null;
    matrices?.setUsage(THREE.DynamicDrawUsage);
    const meshes = layerPasses(layer).map(([pass, material]) => {
      let mesh: THREE.Mesh;
      if (matrices) {
        const instanced = new THREE.InstancedMesh(geometry, material, capacity);
        instanced.instanceMatrix = matrices;
        mesh = instanced;
      } else {
        mesh = new THREE.Mesh(geometry, material);
      }
      // Bounds go stale under shader displacement, and the scene is one small subject.
      mesh.frustumCulled = false;
      mesh.renderOrder = pass === 'fill' ? layer.options.fillOrder : PASS_ORDER[pass];
      parent.add(mesh);
      return mesh;
    });
    return {
      layer,
      geometry,
      meshes,
      matrices,
      setCount: (count) => {
        for (const mesh of meshes) {
          if (mesh instanceof THREE.InstancedMesh) mesh.count = count;
          mesh.visible = count > 0;
        }
      },
    };
  }

  private removeSolids(solids: Solid[]): void {
    for (const solid of solids) {
      for (const mesh of solid.meshes) mesh.removeFromParent();
      solid.geometry.dispose();
      disposeLayer(solid.layer);
    }
    solids.length = 0;
  }

  private scatterSolid(
    geometry: THREE.BufferGeometry,
    items: ScatterItem[],
    options: LayerOptions,
  ): Solid {
    const solid = this.addSolid(this.island, geometry, options, Math.max(1, items.length));
    const tones = new Float32Array(Math.max(1, items.length) * 3);
    const matrices = solid.matrices?.array as Float32Array;
    items.forEach((item, index) => {
      composeInto(matrices, index * 16, ...item.position, item.rotation, ...item.scale);
      tones[index * 3] = item.tone;
      tones[index * 3 + 1] = item.tone;
    });
    geometry.setAttribute('aTone', new THREE.InstancedBufferAttribute(tones, 3));
    solid.setCount(items.length);
    return solid;
  }

  private buildIsland(seed: number, quality: WorldQuality): void {
    this.removeSolids(this.islandSolids);
    const tier = QUALITY[quality];
    const { halftone, keyline } = tier;
    const model = buildIsland(seed, tier.islandSegments, tier.scatterShare);
    this.tree.position.set(...model.treeOrigin);
    const u = this.uniforms;
    u.uCastPlane.value.set(...model.treeOrigin, 0.03);
    u.uCoast.value.set(model.coast.a1, model.coast.p1, model.coast.a2, model.coast.p2);

    const body = soupGeometry(model.positions, 1.45, model.tones, undefined, model.normals);
    this.islandSolids.push(
      // The lawn is painted first, so the sundial shadow and the hour ticks can land on it.
      this.addSolid(this.island, body, {
        shade: 'smooth',
        normals: true,
        halftone,
        keyline,
        decal: !tier.castShadow,
        fillOrder: ORDER.lawn,
      }),
      this.addSolid(this.island, decalGeometry(model.ticks, TONE.ink), {
        shade: 'facet',
        halftone: false,
        ink: 0,
        sticker: false,
        fillOrder: ORDER.ticks,
      }),
      // Small things get no margin of their own: they sit inside the island's.
      this.scatterSolid(rockGeometry(), [...model.rocks, model.seed], {
        shade: 'facet',
        halftone,
        ink: 0.75,
        sticker: false,
      }),
      this.scatterSolid(tuftGeometry(), model.tufts, {
        shade: 'facet',
        halftone: false,
        ink: 0.5,
        sticker: false,
      }),
    );

    const { emblem } = model;
    const plaque = this.addSolid(
      this.island,
      emblemGeometry(emblem.width, emblem.height, emblem.depth, TONE.plaque),
      { shade: 'emblem', ink: 0.75, sticker: false },
    );
    for (const mesh of plaque.meshes) mesh.position.set(...emblem.position);
    u.uEmblem.value.set(0, 0, emblem.width, emblem.height);
    this.islandSolids.push(plaque);
  }

  /** The sundial shadow of a tree solid: the same geometry, projected onto the lawn. */
  private addCast(solid: Solid): void {
    const material = createCastMaterial(this.uniforms);
    const source = solid.meshes[0];
    let mesh: THREE.Mesh;
    if (source instanceof THREE.InstancedMesh && solid.matrices) {
      const instanced = new THREE.InstancedMesh(
        solid.geometry,
        material,
        source.instanceMatrix.count,
      );
      instanced.instanceMatrix = solid.matrices;
      mesh = instanced;
    } else {
      mesh = new THREE.Mesh(solid.geometry, material);
    }
    mesh.frustumCulled = false;
    mesh.renderOrder = ORDER.cast;
    // Parented to the island: the shader moves tree-space vertices onto the lawn itself.
    this.island.add(mesh);
    solid.meshes.push(mesh);
    this.casts.push(mesh);
    this.castMaterials.push(material);
  }

  private buildTree(seed: number, species: Species, quality: WorldQuality): void {
    this.removeSolids(this.treeSolids);
    for (const material of this.castMaterials) material.dispose();
    this.castMaterials.length = 0;
    this.casts.length = 0;
    const tier = QUALITY[quality];
    const { halftone, keyline } = tier;
    const skeleton = generateTree(seed, species);
    const pose = createPose(skeleton);
    this.skeleton = skeleton;
    this.pose = pose;

    this.wood = woodGeometry(skeleton, tier.trunkSides, tier.branchSides, TONE.bark);
    const wood = this.addSolid(this.tree, this.wood.geometry, {
      shade: 'smooth',
      halftone,
      keyline,
      sticker: tier.woodSticker,
    });
    this.treeSolids.push(wood);

    // Clumps: the pose's matrix buffer is the instance buffer, so posing uploads directly.
    const clumpCount = skeleton.clumps.length;
    const tiers = skeleton.shape === 'tier';
    const clumpGeometry = tiers ? tierGeometry(9) : blobGeometry(tier.clumpDetail);
    const clumps = this.addSolid(
      this.tree,
      clumpGeometry,
      tiers
        ? { shade: 'smooth', normals: true, halftone, keyline }
        : { shade: 'smooth', gloss: true, halftone, keyline, flatten: SHADING.clumpFlatten },
      clumpCount,
    );
    const clumpMatrices = new THREE.InstancedBufferAttribute(pose.clumpMatrix, 16);
    clumpMatrices.setUsage(THREE.DynamicDrawUsage);
    for (const mesh of clumps.meshes) (mesh as THREE.InstancedMesh).instanceMatrix = clumpMatrices;
    clumps.matrices = clumpMatrices;
    const variants = [TONE.canopyA, TONE.canopyB, TONE.canopyC];
    const clumpTones = new Float32Array(clumpCount * 3);
    const clumpSway = new Float32Array(clumpCount * 3);
    const swayOf = (branchIndex: number, flutter: number, out: Float32Array, at: number) => {
      const branch = skeleton.branches[branchIndex];
      const node = branch ? branch.nodeStart + branch.nodeCount - 1 : 0;
      out[at] = skeleton.nodeSway[node * 3] as number;
      out[at + 1] = Math.max(skeleton.nodeSway[node * 3 + 1] as number, flutter);
      out[at + 2] = (skeleton.nodeSway[node * 3 + 2] as number) + at * 0.013;
    };
    skeleton.clumps.forEach((clump, index) => {
      const tone = clump.alt ? TONE.canopyAlt : (variants[clump.variant % 3] as number);
      // Blossoming clumps start in leaf green (tone A) and bloom into their variant (tone B).
      clumpTones[index * 3] = clump.bloom <= 1 ? TONE.canopyAlt : tone;
      clumpTones[index * 3 + 1] = tone;
      swayOf(clump.branch, tiers ? 0.08 : 0.22, clumpSway, index * 3);
    });
    this.clumpTones = new THREE.InstancedBufferAttribute(clumpTones, 3);
    this.clumpTones.setUsage(THREE.DynamicDrawUsage);
    clumpGeometry.setAttribute('aTone', this.clumpTones);
    clumpGeometry.setAttribute('aSway', new THREE.InstancedBufferAttribute(clumpSway, 3));
    this.clumps = clumps;
    this.treeSolids.push(clumps);

    if (tier.castShadow) {
      this.addCast(wood);
      this.addCast(clumps);
    }

    // Accents within this tier's share, split by kind because each has its own geometry.
    const drawn = skeleton.accents.filter((accent) => accent.rank < tier.accentShare);
    this.accentKind = new Uint8Array(drawn.length);
    this.accentSlot = new Uint16Array(drawn.length);
    const counts = [0, 0];
    drawn.forEach((accent, index) => {
      const kind = accent.kind === 'blossom' ? 1 : 0;
      this.accentKind[index] = kind;
      this.accentSlot[index] = counts[kind] as number;
      counts[kind] = (counts[kind] as number) + 1;
    });
    const accentSolid = (kind: number, geometry: THREE.BufferGeometry) => {
      const capacity = counts[kind] as number;
      if (capacity === 0) {
        geometry.dispose();
        return null;
      }
      const solid = this.addSolid(
        this.tree,
        geometry,
        { shade: 'facet', halftone: false, ink: 0.75, keyline, flatten: SHADING.clumpFlatten },
        capacity,
      );
      const tones = new Float32Array(capacity * 3);
      const sway = new Float32Array(capacity * 3);
      drawn.forEach((accent, index) => {
        if (this.accentKind[index] !== kind) return;
        const slot = this.accentSlot[index] as number;
        // Seed leaves are plain leaf green; later accents are the lime die-cut leaves.
        const tone = kind === 1 ? TONE.petal : accent.hideBelow < 0 ? TONE.canopyAlt : TONE.accent;
        tones[slot * 3] = tone;
        tones[slot * 3 + 1] = tone;
        const clump = skeleton.clumps[accent.clump];
        swayOf(clump ? clump.branch : 0, 0.3, sway, slot * 3);
      });
      geometry.setAttribute('aTone', new THREE.InstancedBufferAttribute(tones, 3));
      geometry.setAttribute('aSway', new THREE.InstancedBufferAttribute(sway, 3));
      this.treeSolids.push(solid);
      return solid;
    };
    this.leaves = accentSolid(0, leafGeometry());
    this.blossoms = accentSolid(1, blossomGeometry());

    this.posed.growth = -1;
    this.toned.vitality = -1;
  }

  private applyPose(ageDays: number): void {
    const { skeleton, pose, wood, clumps } = this;
    if (!skeleton || !pose || !wood || !clumps || !this.quality) return;
    poseTree(skeleton, this.shown.growth, pose, {
      pop: this.shown.pop,
      vitality: this.shown.vitality,
      ageDays,
      accentShare: QUALITY[this.quality].accentShare,
    });
    writeWood(wood, skeleton, pose);

    if (clumps.matrices) clumps.matrices.needsUpdate = true;
    clumps.setCount(pose.clumpCount);
    if (this.clumpTones) {
      const tones = this.clumpTones.array as Float32Array;
      let changed = false;
      for (let i = 0; i < skeleton.clumps.length; i += 1) {
        const bloom = pose.clumpBloom[i] as number;
        if (tones[i * 3 + 2] !== bloom) {
          tones[i * 3 + 2] = bloom;
          changed = true;
        }
      }
      if (changed) this.clumpTones.needsUpdate = true;
    }

    const born = [0, 0];
    const targets = [this.leaves, this.blossoms];
    for (let i = 0; i < pose.accentSlots; i += 1) {
      const kind = this.accentKind[i] as number;
      const target = targets[kind]?.matrices;
      if (!target) continue;
      const slot = this.accentSlot[i] as number;
      (target.array as Float32Array).set(
        pose.accentMatrix.subarray(i * 16, i * 16 + 16),
        slot * 16,
      );
      if (i < pose.accentCount) born[kind] = slot + 1;
    }
    targets.forEach((solid, kind) => {
      if (!solid?.matrices) return;
      solid.matrices.needsUpdate = true;
      solid.setCount(born[kind] as number);
    });
  }

  /**
   * Brings the Grove up to date for this frame. Returns whether anything visible
   * changed, so a reduced-motion session can skip rendering identical frames.
   */
  update(frame: WorldFrame, camera: THREE.OrthographicCamera, quality: WorldQuality): boolean {
    const { snapshot, dt } = frame;
    const still = frame.reducedMotion;
    let dirty = !still;

    // The camera is orthographic in CSS-pixel units: one world unit of the camera is
    // one CSS pixel of the canvas, measured this frame.
    const { width, height } = frame.canvas;
    if (this.last.width !== width || this.last.height !== height) {
      camera.left = -width / 2;
      camera.right = width / 2;
      camera.top = height / 2;
      camera.bottom = -height / 2;
      camera.updateProjectionMatrix();
      this.last.width = width;
      this.last.height = height;
      dirty = true;
    }

    const rebuilt = quality !== this.quality || snapshot.seed !== this.seed;
    if (rebuilt) this.buildIsland(snapshot.seed, quality);
    const swapped = snapshot.species !== this.species;
    if (rebuilt || swapped) {
      this.buildTree(snapshot.seed, snapshot.species, quality);
      // A new species regrows from the ground instead of morphing.
      if (swapped && this.started && !still) this.shown.growth = 0;
      dirty = true;
    }
    this.quality = quality;
    this.seed = snapshot.seed;
    this.species = snapshot.species;

    // Ease what is shown towards the snapshot. The very first frame snaps.
    const growthTarget = clamp01(snapshot.growth);
    const vitalityTarget = clamp01(snapshot.vitality);
    const hourTarget = wrapHour(snapshot.hour);
    const pitchTarget = CAMERA.pitchByMode[frame.mode];
    const shown = this.shown;
    const before = shown.growth;
    if (!this.started || still) {
      shown.growth = growthTarget;
      shown.vitality = vitalityTarget;
      shown.hour = hourTarget;
      shown.pitch = pitchTarget;
      shown.pop = 0;
    } else {
      shown.growth = damp(shown.growth, growthTarget, MOTION.growthLambda, dt);
      if (Math.abs(growthTarget - shown.growth) < 2e-4) shown.growth = growthTarget;
      shown.vitality = damp(shown.vitality, vitalityTarget, MOTION.vitalityLambda, dt);
      if (Math.abs(vitalityTarget - shown.vitality) < 1e-3) shown.vitality = vitalityTarget;
      const turn = hourDelta(shown.hour, hourTarget);
      shown.hour =
        Math.abs(turn) < 0.003
          ? hourTarget
          : wrapHour(shown.hour + turn * (1 - Math.exp(-MOTION.hourLambda * dt)));
      shown.pitch = damp(shown.pitch, pitchTarget, MOTION.pitchLambda, dt);
      if (Math.abs(pitchTarget - shown.pitch) < 1e-4) shown.pitch = pitchTarget;
      // New parts overshoot only while growth is actually moving, then settle.
      const rate = dt > 0 ? Math.max(0, shown.growth - before) / dt : 0;
      const pop = clamp01(rate * 14) * MOTION.popOvershoot;
      shown.pop = pop > shown.pop ? pop : damp(shown.pop, pop, 6, dt);
      if (shown.pop < 1e-3) shown.pop = 0;
    }
    this.started = true;

    const posed = this.posed;
    if (
      posed.growth !== shown.growth ||
      posed.vitality !== shown.vitality ||
      posed.pop !== shown.pop ||
      posed.age !== snapshot.ageDays
    ) {
      this.applyPose(snapshot.ageDays);
      posed.growth = shown.growth;
      posed.vitality = shown.vitality;
      posed.pop = shown.pop;
      posed.age = snapshot.ageDays;
      dirty = true;
    }

    const u = this.uniforms;
    if (this.toned.vitality !== shown.vitality || this.toned.growth !== shown.growth) {
      resolveTones(this.tones, snapshot.species, shown.vitality, shown.growth);
      u.uBase.value = this.tones.lit;
      u.uShade.value = this.tones.shade;
      u.uHighlight.value = this.tones.highlight;
      u.uGloss.value = glossFor(shown.vitality);
      u.uDroop.value = droopFor(shown.vitality);
      this.toned.vitality = shown.vitality;
      this.toned.growth = shown.growth;
    }
    if (this.lit !== shown.hour) {
      const light = lightAt(shown.hour);
      u.uGrade.value.set(...light.grade);
      u.uSun.value.set(...light.sun);
      u.uCast.value = light.castShadow;
      this.lit = shown.hour;
      dirty = true;
    }
    for (const mesh of this.casts) mesh.visible = u.uCast.value > 0.01 && shown.growth > 0.01;
    const rings = ISLAND.emblem.rings.filter((days) => snapshot.ageDays >= days).length;
    if (u.uRings.value !== rings) {
      u.uRings.value = rings;
      dirty = true;
    }

    // Placement: an eased virtual frame fitted into the box the tracker hands over.
    const metrics = this.skeleton?.metrics;
    if (!metrics) return dirty;
    const bleed = frame.mode === 'hero' || frame.mode === 'hub';
    const placement = fitSubject({
      box: frame.box,
      canvas: frame.canvas,
      frame: subjectFrame(metrics, shown.growth, shown.pitch),
      fit: frame.fit,
      anchor: frame.anchor,
      chrome: bleed ? Math.min(CAMERA.bleedChrome, frame.box.height * 0.12) : 0,
    });
    this.placement = placement;
    const time = still ? STILL_TIME : frame.time;
    const lift = frame.lift;
    const scale = placement.scale * frame.appear * (1 + MOTION.carriedScale * lift);
    const bob = still ? 0 : Math.sin((time * TAU) / CAMERA.bobPeriod) * CAMERA.bob * scale;
    const idle = CAMERA.idle[frame.mode];
    const idleYaw = still
      ? 0
      : (idle.turn > 0 ? (time * TAU) / idle.turn : 0) +
        idle.drift * Math.sin((time * TAU) / idle.period);
    // The idle turn belongs to the mode; easing it keeps a stage change from snapping the island.
    shown.yaw = this.started && dt > 0 && !still ? damp(shown.yaw, idleYaw, 4, dt) : idleYaw;
    const yaw = CAMERA.yaw + this.orbit + shown.yaw;
    this.root.position.set(placement.x, placement.y + bob, 0);
    this.root.rotation.z = MOTION.carriedTilt * lift;
    this.root.scale.setScalar(scale);
    this.tilt.rotation.x = shown.pitch;
    this.spin.rotation.y = yaw;
    if (
      this.last.x !== placement.x ||
      this.last.y !== placement.y ||
      this.last.scale !== scale ||
      this.last.yaw !== yaw
    ) {
      this.last.x = placement.x;
      this.last.y = placement.y;
      this.last.scale = scale;
      this.last.yaw = yaw;
      dirty = true;
    }

    const { sticker } = placement;
    const weighed = this.weighed;
    if (
      weighed.ink !== sticker.ink ||
      weighed.margin !== sticker.margin ||
      weighed.shadow !== sticker.shadow ||
      weighed.lift !== lift
    ) {
      for (const solid of this.islandSolids) weighLayer(solid.layer, sticker, lift);
      for (const solid of this.treeSolids) weighLayer(solid.layer, sticker, lift);
      weighed.ink = sticker.ink;
      weighed.margin = sticker.margin;
      weighed.shadow = sticker.shadow;
      weighed.lift = lift;
      // Halftone dots follow the line weight: finer on a thumbnail, 7 px at full size.
      const full = STICKER.steps[STICKER.steps.length - 1]?.ink ?? sticker.ink;
      u.uDotPitch.value = SHADING.dotPitchPx * Math.max(0.6, sticker.ink / full);
    }

    u.uTime.value = time;
    u.uWind.value.w = (still ? 0.5 : 1) * swayFor(shown.vitality);
    u.uGroveScale.value = scale;
    u.uGroveOrigin.value.copy(this.root.position);

    // Low tier: a flat patch under the crown, pushed where the sundial shadow would fall.
    const reach = Math.max(0.3, (this.pose?.stats.halfWidth ?? 0) * 0.74);
    const sun = u.uSun.value;
    const flat = Math.hypot(sun.x, sun.z) || 1;
    u.uDecal.value.set(
      this.tree.position.x - (sun.x / flat) * reach * 0.55,
      this.tree.position.z - (sun.z / flat) * reach * 0.55,
      Math.min(reach, ISLAND.radius * 0.7),
      smoothstep(0.07, 0.16, shown.growth) * u.uCast.value,
    );
    return dirty;
  }

  /** Frees GPU resources. The rig can be updated again afterwards: it rebuilds itself. */
  dispose(): void {
    this.removeSolids(this.islandSolids);
    this.removeSolids(this.treeSolids);
    for (const material of this.castMaterials) material.dispose();
    this.castMaterials.length = 0;
    this.casts.length = 0;
    this.quality = null;
    this.species = null;
    this.seed = Number.NaN;
    this.skeleton = null;
    this.pose = null;
    this.wood = null;
    this.clumps = null;
    this.leaves = null;
    this.blossoms = null;
    this.clumpTones = null;
    this.weighed.ink = -1;
    this.last.width = 0;
  }
}
