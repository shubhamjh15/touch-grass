'use client';

import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { BurstKind } from '../pulses';
import { registerSpawner, type Spawner } from './burstBus';
import { live } from './live';
import { useDispose } from './sceneStore';

/**
 * Loose bits thrown by pulses and taps: leaves, petals, confetti, water drops, dust.
 * One pooled, instanced mesh of small unlit cards; particles are plain numbers in typed
 * arrays, stepped on the CPU (there are never more than a couple of hundred), and
 * nothing is allocated after the pool is built.
 *
 * This is the generic layer every pulse lands on today. Bespoke choreography per pulse
 * (a prop dropping in, a watering can) is built on top by calling `spawnBurst` from
 * `burstBus.ts`.
 */

const CAPACITY = 220;

interface Preset {
  colours: readonly string[];
  life: readonly [number, number];
  size: readonly [number, number];
  gravity: number;
  drag: number;
  /** Sideways flutter while falling. */
  flutter: number;
  spin: number;
}

const PRESETS: Record<BurstKind, Preset> = {
  pops: {
    colours: ['#d9f99d', '#bef264', '#fef08a', '#ffffff'],
    life: [0.6, 1.0],
    size: [0.1, 0.18],
    gravity: -0.6,
    drag: 2.4,
    flutter: 0.2,
    spin: 6,
  },
  leaves: {
    colours: ['#4ade80', '#86efac', '#22c55e', '#bef264'],
    life: [1.6, 2.6],
    size: [0.14, 0.22],
    gravity: 1.5,
    drag: 1.6,
    flutter: 1.3,
    spin: 4,
  },
  confetti: {
    colours: ['#f472b6', '#facc15', '#9974f8', '#ff6b4a', '#60a5fa', '#4ade80'],
    life: [1.4, 2.2],
    size: [0.1, 0.16],
    gravity: 3.2,
    drag: 0.9,
    flutter: 0.8,
    spin: 9,
  },
  drops: {
    colours: ['#7dd3fc', '#bae6fd', '#38bdf8'],
    life: [0.5, 0.75],
    size: [0.07, 0.11],
    gravity: 9,
    drag: 0,
    flutter: 0,
    spin: 0,
  },
  dust: {
    colours: ['#e7c9a0', '#d4a373', '#f3dcb8'],
    life: [0.5, 0.9],
    size: [0.1, 0.18],
    gravity: -0.3,
    drag: 3,
    flutter: 0.1,
    spin: 2,
  },
  soil: {
    colours: ['#b98652', '#96633a', '#d4a373'],
    life: [0.5, 0.8],
    size: [0.07, 0.12],
    gravity: 6,
    drag: 0.6,
    flutter: 0,
    spin: 6,
  },
  fruit: {
    colours: ['#ff6b4a', '#f472b6', '#facc15'],
    life: [1.1, 1.6],
    size: [0.12, 0.18],
    gravity: 2.2,
    drag: 1.4,
    flutter: 0.2,
    spin: 3,
  },
  petals: {
    colours: ['#fbcfe8', '#f9a8d4', '#fff1f8', '#ffffff'],
    life: [2.6, 4.2],
    size: [0.1, 0.16],
    gravity: 0.7,
    drag: 1.8,
    flutter: 1.6,
    spin: 3,
  },
};

const matrix = new THREE.Matrix4();
const position = new THREE.Vector3();
const quaternion = new THREE.Quaternion();
const scale = new THREE.Vector3();
const euler = new THREE.Euler();
const tint = new THREE.Color();

export function Bursts() {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const geometry = useMemo(() => {
    // A small diamond: reads as a leaf, a petal or a scrap of confetti.
    const shape = new THREE.BufferGeometry();
    shape.setAttribute(
      'position',
      new THREE.Float32BufferAttribute([0, -0.5, 0, 0.36, 0, 0.08, 0, 0.5, 0, -0.36, 0, 0.08], 3),
    );
    shape.setIndex([0, 1, 2, 0, 2, 3]);
    shape.computeVertexNormals();
    return shape;
  }, []);
  const material = useMemo(
    () => new THREE.MeshBasicMaterial({ color: '#ffffff', side: THREE.DoubleSide }),
    [],
  );
  useDispose(geometry);
  useDispose(material);

  const pool = useMemo(
    () => ({
      // x y z, vx vy vz, age life, size spin phase kind
      data: new Float32Array(CAPACITY * 12),
      alive: 0,
      seed: 1,
    }),
    [],
  );

  useEffect(() => {
    const random = () => {
      // Small LCG: cosmetic scatter only, and it keeps the frame loop free of Math.random objects.
      pool.seed = (pool.seed * 1664525 + 1013904223) >>> 0;
      return pool.seed / 4294967296;
    };
    const kinds = Object.keys(PRESETS) as BurstKind[];
    const spawn: Spawner = (kind, count, at) => {
      if (live.reduced) return;
      const preset = PRESETS[kind];
      const { tree } = live;
      const crownY = tree.y + tree.top * 0.66;
      const reach = Math.max(0.3, tree.halfWidth * 0.85);
      const instanced = mesh.current;
      for (let i = 0; i < count && pool.alive < CAPACITY; i += 1) {
        const o = pool.alive * 12;
        const angle = random() * Math.PI * 2;
        const out = Math.sqrt(random());
        let x = tree.x + Math.cos(angle) * reach * out;
        let y = crownY + (random() - 0.3) * tree.top * 0.4;
        let z = tree.z + Math.sin(angle) * reach * out;
        let vx = Math.cos(angle) * 0.9;
        let vy = 0.6 + random() * 0.8;
        let vz = Math.sin(angle) * 0.9;
        if (kind === 'confetti') {
          y = tree.y + tree.top * 0.92;
          vx *= 2.6;
          vz *= 2.6;
          vy = 3 + random() * 2.2;
        } else if (kind === 'drops') {
          x = tree.x + (random() - 0.5) * 0.7;
          z = tree.z + 0.25 + (random() - 0.5) * 0.5;
          y = tree.y + 1.6 + random() * 1.2;
          vx = 0;
          vz = 0;
          vy = -1;
        } else if (kind === 'dust' || kind === 'soil') {
          const ring = kind === 'dust' ? 0.5 + random() * 0.4 : 0.12 + random() * 0.16;
          x = tree.x + Math.cos(angle) * ring;
          z = tree.z + Math.sin(angle) * ring;
          y = tree.y + 0.08;
          vx = Math.cos(angle) * (kind === 'dust' ? 1.6 : 1.1);
          vz = Math.sin(angle) * (kind === 'dust' ? 1.6 : 1.1);
          vy = kind === 'dust' ? 0.5 : 2 + random() * 1.4;
        } else if (kind === 'petals') {
          vx *= 0.4;
          vz *= 0.4;
          vy = 0.2;
        } else if (kind === 'pops') {
          vx *= 1.4;
          vz *= 1.4;
          vy = 1.2 + random();
        }
        if (at) {
          x = at[0] + (random() - 0.5) * 0.4;
          y = at[1] + (random() - 0.5) * 0.3;
          z = at[2] + (random() - 0.5) * 0.4;
        }
        const { data } = pool;
        data[o] = x;
        data[o + 1] = y;
        data[o + 2] = z;
        data[o + 3] = vx;
        data[o + 4] = vy;
        data[o + 5] = vz;
        data[o + 6] = 0;
        data[o + 7] = preset.life[0] + random() * (preset.life[1] - preset.life[0]);
        data[o + 8] = preset.size[0] + random() * (preset.size[1] - preset.size[0]);
        data[o + 9] = (random() - 0.5) * 2 * preset.spin;
        data[o + 10] = random() * 6.28;
        data[o + 11] = kinds.indexOf(kind);
        if (instanced) {
          tint.set(preset.colours[Math.floor(random() * preset.colours.length)] as string);
          instanced.setColorAt(pool.alive, tint);
        }
        pool.alive += 1;
      }
      if (instanced?.instanceColor) instanced.instanceColor.needsUpdate = true;
    };
    return registerSpawner(spawn);
  }, [pool]);

  useFrame(() => {
    const instanced = mesh.current;
    if (!instanced) return;
    const { data } = pool;
    const dt = live.dt;
    const kinds = Object.keys(PRESETS) as BurstKind[];
    let i = 0;
    while (i < pool.alive) {
      const o = i * 12;
      const age = (data[o + 6] as number) + dt;
      const life = data[o + 7] as number;
      if (age >= life) {
        // Swap the last live particle into this slot, colour included.
        pool.alive -= 1;
        const last = pool.alive * 12;
        data.copyWithin(o, last, last + 12);
        if (instanced.instanceColor) {
          const colours = instanced.instanceColor.array as Float32Array;
          colours.copyWithin(i * 3, pool.alive * 3, pool.alive * 3 + 3);
          instanced.instanceColor.needsUpdate = true;
        }
        continue;
      }
      const preset = PRESETS[kinds[data[o + 11] as number] as BurstKind];
      const phase = data[o + 10] as number;
      const drag = Math.exp(-preset.drag * dt);
      data[o + 3] = (data[o + 3] as number) * drag;
      data[o + 4] = (data[o + 4] as number) * drag - preset.gravity * dt;
      data[o + 5] = (data[o + 5] as number) * drag;
      const sway = Math.sin(age * 5 + phase) * preset.flutter;
      data[o] = (data[o] as number) + ((data[o + 3] as number) + sway * 0.5) * dt;
      data[o + 1] = (data[o + 1] as number) + (data[o + 4] as number) * dt;
      data[o + 2] =
        (data[o + 2] as number) +
        ((data[o + 5] as number) + Math.cos(age * 4 + phase) * preset.flutter * 0.4) * dt;
      data[o + 6] = age;
      // Pop in fast, shrink away at the end.
      const t = age / life;
      const size = (data[o + 8] as number) * Math.min(1, t * 9) * Math.min(1, (1 - t) * 4);
      position.set(data[o] as number, data[o + 1] as number, data[o + 2] as number);
      const turn = phase + age * (data[o + 9] as number);
      quaternion.setFromEuler(euler.set(turn, turn * 0.7, sway));
      scale.setScalar(size);
      matrix.compose(position, quaternion, scale);
      matrix.toArray(instanced.instanceMatrix.array, i * 16);
      i += 1;
    }
    if (instanced.count !== pool.alive || pool.alive > 0)
      instanced.instanceMatrix.needsUpdate = true;
    instanced.count = pool.alive;
    instanced.visible = pool.alive > 0;
  });

  return (
    <instancedMesh
      ref={mesh}
      args={[geometry, material, CAPACITY]}
      frustumCulled={false}
      visible={false}
    />
  );
}
