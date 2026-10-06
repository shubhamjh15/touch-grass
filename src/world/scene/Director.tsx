'use client';

import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef, type ReactNode, type RefObject } from 'react';
import * as THREE from 'three';
import { clamp, clamp01, damp } from '@/lib/math';
import { atmosphereAt, moodAt } from '../atmosphere';
import { viewFor, type View } from '../camera';
import { MOTION } from '../config';
import { hourDelta, wrapHour } from '../daylight';
import { emitWorldHover, emitWorldTap, onTap, pointer } from '../interaction';
import { PulseScheduler, type BurstKind } from '../pulses';
import { onPulse, useWorldStore, worldStats } from '../store';
import { createTerrain } from '../terrain';
import type { WorldFrame } from '../tracker';
import { spawnBurst } from './burstBus';
import { hitTest } from './hits';
import { live, shared } from './live';
import { useScene } from './sceneStore';

/**
 * The per-frame logic of the scene, split into three small parts that run in order
 * before anything draws:
 *
 *   Director  (priority -30)  the tracker's frame becomes `live`: eased growth, vitality
 *                             and hour, light and mood, pulses, the shared uniforms;
 *   CameraRig (priority -20)  frames the tree for the stage and applies the orbit;
 *   Pointer   (priority -10)  one ray per moved pointer, hover and tap by part name.
 *
 * None of them sets React state per frame. The only renders they cause are the rare
 * structural changes (another species or seed, the sky switching on or off).
 */

const BURST_SHARE = { low: 0.5, medium: 0.8, high: 1 } as const;

export function Director({ frame }: { frame: RefObject<WorldFrame | null> }) {
  const state = useRef({
    started: false,
    regrow: 0,
    atmosphereHour: Number.NaN,
    moodVitality: Number.NaN,
    scheduler: new PulseScheduler(),
  });

  useEffect(() => {
    const { scheduler } = state.current;
    const stop = onPulse((pulse) => scheduler.push(pulse, live.time));
    return () => {
      stop();
      scheduler.clear();
    };
  }, []);

  useFrame((three, delta) => {
    const current = frame.current;
    if (!current) return;
    const local = state.current;
    const dt = clamp(delta, 0, 0.1);
    const snapshot = current.snapshot;
    const reduced = current.reducedMotion;
    live.time = current.time;
    live.dt = dt;
    live.reduced = reduced;
    live.mode = current.mode;
    live.quality = useWorldStore.getState().quality;
    live.ageDays = snapshot.ageDays;
    live.aspect = three.size.width / Math.max(1, three.size.height);

    // Structure: another tree or another island is a rebuild, done by React.
    if (snapshot.seed !== live.seed || snapshot.species !== live.species || !local.started) {
      const replaced = local.started;
      live.seed = snapshot.seed;
      live.species = snapshot.species;
      live.terrain = createTerrain(snapshot.seed);
      useScene.setState({ seed: snapshot.seed, species: snapshot.species });
      // A previewed species grows in from a sprout, quickly.
      if (replaced && !reduced) {
        live.growth = Math.min(live.growth, 0.03);
        local.regrow = 1.4;
      }
    }
    const sky = current.stage ? current.stage.options.sky : useScene.getState().sky;
    if (sky !== useScene.getState().sky || current.mode !== useScene.getState().mode) {
      useScene.setState({ sky, mode: current.mode });
    }

    // Growth, vitality and hour ease towards the snapshot.
    const target = clamp01(snapshot.growth);
    if (!local.started || reduced) {
      live.growth = target;
      live.vitality = clamp01(snapshot.vitality);
      live.hour = wrapHour(snapshot.hour);
      live.growing = 0;
    } else {
      local.regrow = Math.max(0, local.regrow - dt);
      const boost = local.regrow > 0 ? MOTION.regrowBoost : 1;
      live.growth = damp(live.growth, target, MOTION.growthLambda * boost, dt);
      if (Math.abs(target - live.growth) < 2e-4) live.growth = target;
      const moving = clamp01(Math.abs(target - live.growth) * 30);
      live.growing = damp(live.growing, moving, moving > live.growing ? 14 : 3, dt);
      if (live.growing < 0.01 && moving === 0) live.growing = 0;
      live.vitality = damp(live.vitality, clamp01(snapshot.vitality), MOTION.vitalityLambda, dt);
      const turn = hourDelta(live.hour, wrapHour(snapshot.hour));
      live.hour =
        Math.abs(turn) < 0.002
          ? wrapHour(snapshot.hour)
          : wrapHour(live.hour + turn * (1 - Math.exp(-MOTION.hourLambda * dt)));
    }
    local.started = true;
    if (!(Math.abs(live.hour - local.atmosphereHour) < 0.004)) {
      local.atmosphereHour = live.hour;
      live.atmosphere = atmosphereAt(live.hour);
    }
    if (!(Math.abs(live.vitality - local.moodVitality) < 0.002)) {
      local.moodVitality = live.vitality;
      live.mood = moodAt(live.vitality);
    }

    // Pulses: channels for this frame, and the bursts that became due.
    const share = BURST_SHARE[live.quality];
    local.scheduler.update(current.time, reduced, (kind: BurstKind, count: number) =>
      spawnBurst(kind, Math.max(1, Math.round(count * share))),
    );
    live.channels = local.scheduler.channels;
    live.yaw = current.yaw;
    live.tilt = current.tilt;
    live.appear = current.appear;

    // Shared uniforms. Reduced motion keeps a slow, shallow sway and nothing else.
    const { mood, channels } = live;
    shared.uTime.value = reduced ? current.time * 0.35 : current.time;
    shared.uWind.value.z =
      mood.sway * (reduced ? 0.45 : 1) * (1 + 0.25 * Math.sin(current.time * 0.23));
    shared.uMood.value.set(mood.dry, mood.cold);
    shared.uFlash.value = channels.flash;
    shared.uDroop.value = mood.droop;
    live.shake = Math.max(0, live.shake - dt * 1.7);
    shared.uShake.value = reduced ? 0 : live.shake;
    shared.uRipple.value.z += dt;
    // The crown's shadow on the lawn, as a blob: its centre slides away from the sun.
    const { tree, atmosphere } = live;
    const [lx, ly, lz] = atmosphere.lightDir;
    const throwLength = (tree.top * 0.6) / Math.max(0.3, ly);
    shared.uCrown.value.set(
      tree.x - lx * throwLength,
      tree.z - lz * throwLength,
      Math.max(0.3, tree.halfWidth * 1.05),
      atmosphere.shadow * clamp01(live.growth * 9),
    );
    worldStats.growth = live.growth;
  }, -30);

  return null;
}

const wanted: View = { targetX: 0, targetY: 1, targetZ: 0, distance: 14, pitch: 0.23, span: 6 };

export function CameraRig({ frame }: { frame: RefObject<WorldFrame | null> }) {
  const shown = useRef<View & { ready: boolean }>({ ...wanted, ready: false });

  useFrame((three) => {
    const current = frame.current;
    if (!current) return;
    const camera = three.camera as THREE.PerspectiveCamera;
    const { tree } = live;
    viewFor(
      {
        mode: live.mode,
        aspect: live.aspect,
        fit: current.fit,
        anchor: current.anchor,
        growth: live.growth,
        treeTop: tree.top,
        treeHalfWidth: tree.halfWidth,
        treeX: tree.x,
        treeZ: tree.z,
      },
      wanted,
    );
    const view = shown.current;
    if (!view.ready || live.reduced) {
      Object.assign(view, wanted);
      view.ready = true;
    } else {
      const lambda = 3.4;
      view.targetX = damp(view.targetX, wanted.targetX, lambda, live.dt);
      view.targetY = damp(view.targetY, wanted.targetY, lambda, live.dt);
      view.targetZ = damp(view.targetZ, wanted.targetZ, lambda, live.dt);
      view.distance = damp(view.distance, wanted.distance, lambda, live.dt);
      view.pitch = damp(view.pitch, wanted.pitch, lambda, live.dt);
      view.span = wanted.span;
    }
    // The stage's orbit turns the camera about the tree; pulses push in a little.
    const push = live.reduced ? 0 : live.channels.push * 1.4;
    const distance = (view.distance / Math.max(0.5, live.appear)) * (1 - push);
    const pitch = clamp(view.pitch + live.tilt, 0.03, 0.9);
    const yaw = -live.yaw;
    const flat = Math.cos(pitch) * distance;
    camera.position.set(
      view.targetX + Math.sin(yaw) * flat,
      view.targetY + Math.sin(pitch) * distance,
      view.targetZ + Math.cos(yaw) * flat,
    );
    camera.lookAt(view.targetX, view.targetY, view.targetZ);
    worldStats.scale = three.size.height / Math.max(0.001, view.span);
  }, -20);

  return null;
}

/** The island and everything standing on it: pulses make it hop and dip, and it bobs at rest. */
export function IslandGroup({ children }: { children: ReactNode }) {
  const group = useRef<THREE.Group>(null);
  useFrame(() => {
    const node = group.current;
    if (!node) return;
    const { channels } = live;
    const bob = live.reduced ? 0 : Math.sin(live.time * 1.25) * 0.03;
    node.position.y = channels.hop - channels.dip - channels.press * 0.012 + bob;
  }, -25);
  return <group ref={group}>{children}</group>;
}

const point = new THREE.Vector3();

/** Starts a ring on the pond at a point given in island space. */
function dropOnPond(pond: THREE.Mesh, at: THREE.Vector3): void {
  const material = pond.material;
  if (!(material instanceof THREE.ShaderMaterial)) return;
  const drop = material.uniforms.uDrop?.value;
  if (!(drop instanceof THREE.Vector4)) return;
  const local = pond.worldToLocal(at);
  drop.set(local.x, local.y, 0, 1);
}

export function Pointer({ frame }: { frame: RefObject<WorldFrame | null> }) {
  const camera = useThree((three) => three.camera);
  const scene = useThree((three) => three.scene);

  useEffect(() => {
    const stop = onTap((u, v, clientX, clientY) => {
      const hit = hitTest(u, v, camera, clientX, clientY);
      if (!hit) return;
      // The world answers every touch: leaves shake loose, grass and water ripple.
      if (hit.part === 'tree') {
        live.shake = 1;
        spawnBurst(
          live.species === 'cherry' && live.growth > 0.45 ? 'petals' : 'leaves',
          9,
          hit.point,
        );
      } else if (hit.part === 'ground') {
        shared.uRipple.value.set(hit.point[0], hit.point[2], 0, live.reduced ? 0 : 1);
      } else if (hit.part === 'water') {
        const pond = scene.getObjectByName('pond');
        if (pond instanceof THREE.Mesh) dropOnPond(pond, point.set(...hit.point));
      }
      emitWorldTap(hit);
    });
    return () => {
      stop();
      live.hover = null;
      emitWorldHover(null);
    };
  }, [camera, scene]);

  useFrame(() => {
    if (!pointer.moved) return;
    pointer.moved = false;
    const stage = frame.current?.stage;
    const active = pointer.inside && stage?.options.interactive === true;
    const hit = active ? hitTest(pointer.u, pointer.v, camera, pointer.x, pointer.y) : null;
    const part = hit ? hit.part : null;
    if (part === live.hover) return;
    live.hover = part;
    emitWorldHover(hit);
    // The stage element shows what is under the pointer (cursor, styling hooks).
    if (stage) {
      if (part) stage.el.dataset.worldHover = part;
      else delete stage.el.dataset.worldHover;
    }
  }, -10);

  return null;
}
