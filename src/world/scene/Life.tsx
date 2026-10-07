'use client';

import { useFrame } from '@react-three/fiber';
import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { clamp01, damp } from '@/lib/math';
import { createRng } from '@/lib/rng';
import { anchorsFor } from '../anchors';
import { FOV } from '../camera';
import {
  LIFE_CAPS,
  beeAt,
  birdAt,
  butterflyAt,
  createFlyer,
  flinch,
  lifeCounts,
  presenceAt,
  type LifeCounts,
  type LifeProps,
} from '../life';
import { layoutIsland } from '../props/layout';
import { terrainHeight } from '../terrain';
import { spawnBurst } from './burstBus';
import { Kit } from './kit';
import { live, shared } from './live';
import { useDispose, useScene } from './sceneStore';

/**
 * The small lives of the island: butterflies over the flowers, birds about the crown,
 * bees at the hive, fireflies after dark, and the leaves the crown lets go. Three
 * instanced meshes and one cloud of points: four draw calls at most, fewer at night.
 * Where each one is comes from `life.ts` (a function of the clock); wings beat in the
 * vertex shader. Nothing here sets React state or allocates per frame.
 */

const C = {
  white: '#ffffff',
  shade: '#d4d4d8',
  ink: '#27272a',
  blue: '#60a5fa',
  blueDeep: '#3b82f6',
  yellow: '#facc15',
  orange: '#fb923c',
} as const;

const HALF = Math.PI / 2;

function butterflyGeometry(): THREE.BufferGeometry {
  const kit = new Kit();
  kit.box(0.016, 0.016, 0.12, C.ink, { at: [0, 0, 0] });
  for (const side of [-1, 1]) {
    kit.cyl(0.07, 0.07, 0.005, C.white, { at: [side * 0.07, 0, 0.032], tip: 1 }, 7);
    kit.cyl(0.05, 0.05, 0.005, C.shade, { at: [side * 0.052, 0, -0.048], tip: 1 }, 6);
  }
  return kit.build(false);
}

function birdGeometry(): THREE.BufferGeometry {
  const kit = new Kit();
  kit.ball(0.075, C.blue, { scale: [0.95, 0.9, 1.7] });
  kit.ball(0.05, C.white, { at: [0, -0.03, 0.02], scale: [0.9, 0.7, 1.5] }, 0);
  kit.ball(0.058, C.blue, { at: [0, 0.045, 0.115] });
  kit.cone(0.022, 0.06, C.yellow, { at: [0, 0.04, 0.185], rot: [HALF, 0, 0] }, 5);
  kit.box(0.09, 0.012, 0.11, C.blueDeep, { at: [0, 0.01, -0.165], rot: [0.25, 0, 0] });
  for (const side of [-1, 1]) {
    kit.ball(0.009, C.ink, { at: [side * 0.036, 0.062, 0.15] }, 0);
    kit.rbox(0.21, 0.014, 0.12, 0.006, C.blueDeep, { at: [side * 0.14, 0.02, -0.01], tip: 1 });
    kit.rbox(0.09, 0.012, 0.08, 0.005, C.blue, { at: [side * 0.27, 0.02, -0.03], tip: 1 });
  }
  return kit.build(false);
}

function beeGeometry(): THREE.BufferGeometry {
  const kit = new Kit();
  kit.ball(0.036, C.yellow, { scale: [1, 1, 1.5] });
  for (const z of [-0.014, 0.018]) {
    kit.cyl(0.037, 0.037, 0.012, C.ink, { at: [0, 0, z], rot: [HALF, 0, 0] }, 7);
  }
  kit.ball(0.024, C.ink, { at: [0, 0.004, 0.052] }, 0);
  for (const side of [-1, 1]) {
    kit.cyl(0.03, 0.03, 0.003, C.white, { at: [side * 0.034, 0.03, -0.004], tip: 1 }, 6);
  }
  return kit.build(false);
}

/** Lambert with wings: vertices marked by `aTip` swing about the body's long axis. */
function flyerMaterial(): THREE.MeshLambertMaterial {
  const material = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = shared.uTime;
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
uniform float uTime;
attribute float aTip;
attribute vec3 aFly;`,
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
float flyAngle = (sin(uTime * aFly.y + aFly.x) * 0.5 + 0.18) * aFly.z * aTip * sign(position.x);
float flyC = cos(flyAngle);
float flyS = sin(flyAngle);
transformed.xy = vec2(flyC * transformed.x - flyS * transformed.y, flyS * transformed.x + flyC * transformed.y);`,
      );
  };
  material.customProgramCacheKey = () => 'flyer';
  return material;
}

const FIREFLY_VERTEX = /* glsl */ `
uniform float uTime;
uniform float uShow;
uniform float uCount;
uniform float uScale;
attribute vec4 aSeed;
varying float vGlow;
void main() {
  vec3 wander = vec3(
    sin(uTime * (0.21 + aSeed.x * 0.2) + aSeed.y * 6.28),
    sin(uTime * (0.17 + aSeed.y * 0.2) + aSeed.z * 6.28) * 0.55,
    cos(uTime * (0.19 + aSeed.z * 0.2) + aSeed.x * 6.28)
  ) * 0.55;
  vec4 mv = modelViewMatrix * vec4(position + wander, 1.0);
  float blink = smoothstep(0.25, 0.9, sin(uTime * (0.9 + aSeed.x * 1.1) + aSeed.y * 40.0) * 0.5 + 0.5);
  vGlow = (0.15 + 0.85 * blink) * uShow * step(aSeed.w, uCount);
  gl_PointSize = uScale * (0.13 + 0.09 * blink) / max(0.1, -mv.z);
  gl_Position = projectionMatrix * mv;
}
`;

const FIREFLY_FRAGMENT = /* glsl */ `
varying float vGlow;
void main() {
  float d = length(gl_PointCoord - 0.5) * 2.0;
  float core = smoothstep(0.35, 0.0, d);
  float halo = smoothstep(1.0, 0.0, d);
  float glow = (halo * halo * 0.5 + core * 1.8) * vGlow;
  // Light that is added to what is behind it. The alpha is the glow too, so on a stage
  // without a sky a firefly is a soft dot on the page and never an opaque square.
  gl_FragColor = vec4(vec3(1.0, 0.9, 0.38) * glow, min(1.0, glow));
}
`;

const BUTTERFLY_TINTS = [
  '#f472b6',
  '#facc15',
  '#9974f8',
  '#ffffff',
  '#fb923c',
  '#60a5fa',
  '#f9a8d4',
];

const flyer = createFlyer();
const matrix = new THREE.Matrix4();
const position = new THREE.Vector3();
const quaternion = new THREE.Quaternion();
const scaling = new THREE.Vector3();
const euler = new THREE.Euler(0, 0, 0, 'YXZ');
const tint = new THREE.Color();
const counts: LifeCounts = { butterflies: 0, birds: 0, bees: 0, fireflies: 0, leaves: 0 };
const wanted: LifeCounts = { butterflies: 0, birds: 0, bees: 0, fireflies: 0, leaves: 0 };
const startle = { x: 0, y: 0, z: 0 };
const perch = { x: 0, y: 0, z: 0 };

function write(mesh: THREE.InstancedMesh, index: number, size: number): void {
  position.set(flyer.x, flyer.y, flyer.z);
  quaternion.setFromEuler(euler.set(0, flyer.heading, flyer.bank));
  scaling.setScalar(size);
  matrix.compose(position, quaternion, scaling);
  matrix.toArray(mesh.instanceMatrix.array, index * 16);
}

/** Per-instance wing beat: phase, beats per second (as angular speed), reach. */
function flyAttribute(count: number, speed: number, reach: number): THREE.InstancedBufferAttribute {
  const data = new Float32Array(count * 3);
  for (let i = 0; i < count; i += 1) {
    data[i * 3] = i * 2.399;
    data[i * 3 + 1] = speed * (0.9 + ((i * 7) % 5) * 0.05);
    data[i * 3 + 2] = reach;
  }
  return new THREE.InstancedBufferAttribute(data, 3);
}

export function Life() {
  const seed = useScene((state) => state.seed);
  const key = useScene((state) => state.props);
  const caps = LIFE_CAPS.high;

  const owned = useMemo<LifeProps>(() => {
    const has = new Set(key ? key.split(',') : []);
    return {
      flowers: has.has('flowers'),
      butterflies: has.has('butterflies'),
      birds: has.has('birds'),
      birdhouse: has.has('birdhouse'),
      beehive: has.has('beehive'),
      fireflies: has.has('fireflies'),
    };
  }, [key]);

  // Where things live on this island: flowers for butterflies, the hive for bees, the
  // birdhouse roof for the bird that stays.
  const homes = useMemo(() => {
    const anchors = anchorsFor(seed);
    const flowers = layoutIsland(seed).flowers.map((spot) => ({
      x: spot.x,
      y: terrainHeight(seed, spot.x, spot.z),
      z: spot.z,
    }));
    return { flowers, hive: anchors.beehive, birdhouse: anchors.birdhouse };
  }, [seed]);

  const butterflyShape = useMemo(butterflyGeometry, []);
  const birdShape = useMemo(birdGeometry, []);
  const beeShape = useMemo(beeGeometry, []);
  const material = useMemo(flyerMaterial, []);
  useDispose(butterflyShape);
  useDispose(birdShape);
  useDispose(beeShape);
  useDispose(material);

  const butterflies = useRef<THREE.InstancedMesh>(null);
  const birds = useRef<THREE.InstancedMesh>(null);
  const bees = useRef<THREE.InstancedMesh>(null);
  const birdBeat = useMemo(() => flyAttribute(caps.birds, 9, 0.85), [caps.birds]);

  useLayoutEffect(() => {
    butterflyShape.setAttribute('aFly', flyAttribute(caps.butterflies, 11, 1.25));
    birdShape.setAttribute('aFly', birdBeat);
    beeShape.setAttribute('aFly', flyAttribute(caps.bees, 42, 0.6));
    const mesh = butterflies.current;
    if (mesh) {
      for (let i = 0; i < caps.butterflies; i += 1) {
        mesh.setColorAt(i, tint.set(BUTTERFLY_TINTS[i % BUTTERFLY_TINTS.length] as string));
      }
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
  }, [butterflyShape, birdShape, beeShape, birdBeat, caps]);

  // Fireflies: points that wander and blink in the vertex shader.
  const fireflies = useMemo(() => {
    const rng = createRng(seed, 'fireflies', 1);
    const count = caps.fireflies;
    const places = new Float32Array(count * 3);
    const seeds = new Float32Array(count * 4);
    for (let i = 0; i < count; i += 1) {
      const angle = rng() * Math.PI * 2;
      const out = 0.5 + Math.sqrt(rng()) * 2.1;
      places[i * 3] = Math.cos(angle) * out;
      places[i * 3 + 1] = 0.35 + rng() * rng() * 2.6;
      places[i * 3 + 2] = Math.sin(angle) * out * 0.9 + 0.3;
      seeds[i * 4] = rng();
      seeds[i * 4 + 1] = rng();
      seeds[i * 4 + 2] = rng();
      seeds[i * 4 + 3] = i + 0.5;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(places, 3));
    geometry.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 4));
    geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 1.5, 0), 5);
    const shader = new THREE.ShaderMaterial({
      vertexShader: FIREFLY_VERTEX,
      fragmentShader: FIREFLY_FRAGMENT,
      uniforms: {
        uTime: shared.uTime,
        uShow: { value: 0 },
        uCount: { value: 0 },
        uScale: { value: 600 },
      },
      transparent: true,
      blending: THREE.CustomBlending,
      blendSrc: THREE.OneFactor,
      blendDst: THREE.OneFactor,
      blendSrcAlpha: THREE.OneFactor,
      blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
      depthWrite: false,
    });
    return { geometry, shader };
  }, [seed, caps.fireflies]);
  useDispose(fireflies.geometry);
  useDispose(fireflies.shader);
  const glow = useRef<THREE.Points>(null);

  const state = useRef({
    presence: { butterflies: 0, birds: 0, bees: 0, fireflies: 0, leaves: 0 } as LifeCounts,
    air: 0,
    airborneUntil: 0,
    flapping: true,
    leafClock: 0,
  });

  useFrame((three) => {
    const local = state.current;
    const { dt, tree } = live;
    // Reduced motion: everyone is still out, at a stroll.
    const time = live.reduced ? live.time * 0.3 : live.time;
    lifeCounts(live.quality, owned, live.vitality, counts);
    presenceAt(live.hour, wanted);
    const { presence } = local;
    presence.butterflies = damp(presence.butterflies, wanted.butterflies, 2, dt);
    presence.birds = damp(presence.birds, wanted.birds, 2, dt);
    presence.bees = damp(presence.bees, wanted.bees, 2, dt);
    presence.fireflies = damp(presence.fireflies, wanted.fireflies, 1.5, dt);
    startle.x = live.startleAt[0];
    startle.y = live.startleAt[1];
    startle.z = live.startleAt[2];
    const fright = live.reduced ? 0 : live.startle * live.startle;

    const flutter = butterflies.current;
    if (flutter) {
      const shown = presence.butterflies > 0.02 ? counts.butterflies : 0;
      flutter.visible = shown > 0;
      flutter.count = shown;
      for (let i = 0; i < shown; i += 1) {
        const home = homes.flowers[(i * 2) % Math.max(1, homes.flowers.length)] ?? tree;
        butterflyAt(i, time, home, flyer);
        flinch(flyer, startle, fright);
        write(flutter, i, presence.butterflies * 1.35);
      }
      if (shown > 0) flutter.instanceMatrix.needsUpdate = true;
    }

    const hum = bees.current;
    if (hum) {
      const shown = presence.bees > 0.02 ? counts.bees : 0;
      hum.visible = shown > 0;
      hum.count = shown;
      for (let i = 0; i < shown; i += 1) {
        // With a hive, all but the last bee stay by it; the last one works the flowers.
        const atHive = owned.beehive && (i < shown - 1 || !owned.flowers);
        const flower = homes.flowers[(i * 3 + 1) % Math.max(1, homes.flowers.length)];
        if (atHive || !flower) {
          perch.x = homes.hive.x;
          perch.y = homes.hive.y + 0.5;
          perch.z = homes.hive.z + 0.22;
        } else {
          perch.x = flower.x;
          perch.y = flower.y + 0.4;
          perch.z = flower.z;
        }
        beeAt(i, time, perch, flyer);
        flinch(flyer, startle, fright, 1);
        write(hum, i, presence.bees);
      }
      if (shown > 0) hum.instanceMatrix.needsUpdate = true;
    }

    const flock = birds.current;
    if (flock) {
      const shown = presence.birds > 0.02 && live.growth > 0.1 ? counts.birds : 0;
      flock.visible = shown > 0;
      flock.count = shown;
      // The first bird has a perch: the birdhouse roof, or the top of the crown. A shaken
      // tree or a tap nearby sends it up for a few turns.
      if (live.shake > 0.5 || fright > 0.6) local.airborneUntil = time + 7;
      const settled = owned.birdhouse || owned.birds;
      local.air = damp(local.air, settled && time > local.airborneUntil ? 0 : 1, 1.6, dt);
      const flapping = local.air > 0.04;
      if (flapping !== local.flapping) {
        local.flapping = flapping;
        birdBeat.setZ(0, flapping ? 0.85 : 0.06);
        birdBeat.needsUpdate = true;
      }
      for (let i = 0; i < shown; i += 1) {
        birdAt(i, time, tree, flyer);
        if (i === 0 && local.air < 0.999) {
          if (owned.birdhouse) {
            perch.x = homes.birdhouse.x;
            perch.y = homes.birdhouse.y + 1.3;
            perch.z = homes.birdhouse.z;
          } else {
            perch.x = tree.x + tree.halfWidth * 0.2;
            perch.y = tree.y + tree.top * 0.99;
            perch.z = tree.z + 0.1;
          }
          const ease = local.air * local.air * (3 - 2 * local.air);
          const hop = live.reduced ? 0 : Math.max(0, Math.sin(time * 0.9)) ** 24 * 0.05;
          flyer.x = perch.x + (flyer.x - perch.x) * ease;
          flyer.y = perch.y + hop + (flyer.y - perch.y - hop) * ease;
          flyer.z = perch.z + (flyer.z - perch.z) * ease;
          flyer.heading = 0.6 + (flyer.heading - 0.6) * ease;
          flyer.bank *= ease;
        }
        write(flock, i, presence.birds * 1.15);
      }
      if (shown > 0) flock.instanceMatrix.needsUpdate = true;
    }

    const points = glow.current;
    if (points) {
      points.visible = presence.fireflies > 0.02;
      const uniforms = fireflies.shader.uniforms;
      (uniforms.uShow as THREE.IUniform<number>).value = presence.fireflies;
      (uniforms.uCount as THREE.IUniform<number>).value = counts.fireflies;
      (uniforms.uScale as THREE.IUniform<number>).value =
        (three.size.height * three.viewport.dpr) / (2 * Math.tan((FOV * Math.PI) / 360));
    }

    // Leaves let go by the crown, a few a minute; a cherry in bloom sheds petals.
    if (!live.reduced && counts.leaves > 0 && live.growth > 0.12 && three.size.height > 0) {
      local.leafClock += (dt * counts.leaves) / 60;
      if (local.leafClock >= 1) {
        local.leafClock -= 1;
        const blooming = live.species === 'cherry' && live.growth > 0.45 && live.vitality > 0.6;
        spawnBurst(blooming ? 'petals' : 'drift', 1);
      }
    }
    local.leafClock = clamp01(local.leafClock);
  });

  return (
    <group>
      <instancedMesh
        ref={butterflies}
        args={[butterflyShape, material, caps.butterflies]}
        frustumCulled={false}
        visible={false}
      />
      <instancedMesh
        ref={birds}
        args={[birdShape, material, caps.birds]}
        frustumCulled={false}
        visible={false}
      />
      <instancedMesh
        ref={bees}
        args={[beeShape, material, caps.bees]}
        frustumCulled={false}
        visible={false}
      />
      <points
        ref={glow}
        geometry={fireflies.geometry}
        material={fireflies.shader}
        visible={false}
        renderOrder={3}
      />
    </group>
  );
}
