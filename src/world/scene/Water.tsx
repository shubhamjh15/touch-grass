'use client';

import { Sparkles } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useMemo } from 'react';
import * as THREE from 'three';
import { QUALITY } from '../config';
import { useWorldStore } from '../store';
import { createTerrain, type Terrain } from '../terrain';
import { live, shared } from './live';
import { WATER } from './palette';
import { useDispose, useScene } from './sceneStore';

/**
 * The spring: a pond with a wobbling shoreline, drifting glints and a foam edge; a
 * stream that runs from it to the rim; and a waterfall that drops off the island and
 * thins into mist. Two small unlit shaders (toon water needs no lighting model, only the
 * amount of light in the sky, which arrives as one uniform), two draw calls.
 */

const COMMON = /* glsl */ `
uniform float uTime;
uniform vec3 uDeep;
uniform vec3 uShallow;
uniform vec3 uFoam;
uniform vec3 uLight;
`;

const pondMaterial = () =>
  new THREE.ShaderMaterial({
    uniforms: {
      uTime: shared.uTime,
      uDeep: { value: WATER.deep },
      uShallow: { value: WATER.shallow },
      uFoam: { value: WATER.foam },
      uLight: { value: new THREE.Color(1, 1, 1) },
      /** A tap: local x, local y, seconds since, strength. */
      uDrop: { value: new THREE.Vector4(0, 0, 99, 0) },
    },
    vertexShader: /* glsl */ `
      varying vec2 vPoint;
      void main() {
        vPoint = position.xy;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      ${COMMON}
      uniform vec4 uDrop;
      varying vec2 vPoint;
      void main() {
        float r = length(vPoint);
        float angle = atan(vPoint.y, vPoint.x);
        float shore = r + 0.03 * sin(angle * 7.0 + uTime * 0.8) + 0.02 * sin(angle * 3.0 - uTime * 0.5);
        vec3 colour = mix(uDeep, uShallow, smoothstep(0.2, 0.9, shore));
        // Drifting glints: two crossing sine grids, thresholded into flecks.
        float glint = sin(vPoint.x * 13.0 + uTime * 0.9) * sin(vPoint.y * 11.0 - uTime * 0.7)
          + 0.5 * sin((vPoint.x + vPoint.y) * 19.0 + uTime * 1.3);
        colour += uFoam * smoothstep(1.02, 1.3, glint) * 0.45;
        // Slow rings from the spring in the middle, and one from a tap.
        float spring = sin(r * 26.0 - uTime * 2.2) * smoothstep(0.55, 0.0, r);
        colour += uFoam * smoothstep(0.82, 1.0, spring) * 0.22;
        float d = length(vPoint - uDrop.xy);
        float ring = smoothstep(0.035, 0.0, abs(d - uDrop.z * 0.55)) * uDrop.w * max(0.0, 1.0 - uDrop.z * 0.7);
        colour += uFoam * ring;
        float foam = smoothstep(0.8, 0.86, shore + 0.02 * sin(uTime * 1.7 + angle * 11.0));
        colour = mix(colour, uFoam, foam * 0.9);
        gl_FragColor = vec4(colour * uLight, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });

const flowMaterial = () =>
  new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    uniforms: {
      uTime: shared.uTime,
      uDeep: { value: WATER.deep },
      uShallow: { value: WATER.shallow },
      uFoam: { value: WATER.foam },
      uLight: { value: new THREE.Color(1, 1, 1) },
    },
    vertexShader: /* glsl */ `
      attribute vec2 aFlow;
      varying vec2 vFlow;
      void main() {
        vFlow = aFlow;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      ${COMMON}
      // x: across the ribbon (-1..1). y: metres travelled; beyond 100 it is falling.
      varying vec2 vFlow;
      void main() {
        float falling = step(100.0, vFlow.y);
        float along = vFlow.y - falling * 100.0;
        float speed = mix(1.1, 3.4, falling);
        float streak = sin(vFlow.x * 7.0 + sin(along * 3.0) * 1.5) * 0.5 + 0.5;
        float run = fract(along * mix(1.6, 0.9, falling) - uTime * speed + streak * 0.35);
        float white = smoothstep(0.62, 0.95, run) * (0.35 + 0.65 * falling);
        vec3 colour = mix(mix(uShallow, uDeep, 0.25), uFoam, white);
        float edge = smoothstep(1.0, 0.72, abs(vFlow.x));
        colour = mix(uFoam, colour, edge * (1.0 - 0.4 * falling));
        // The fall thins out and breaks up towards the bottom.
        float fade = 1.0 - falling * smoothstep(0.9, 3.0, along);
        float broken = mix(1.0, step(0.25, fract(vFlow.x * 2.5 + along * 1.3 - uTime * 1.1)), falling * smoothstep(1.2, 2.6, along));
        gl_FragColor = vec4(colour * uLight, fade * broken * mix(0.92, 0.85, falling));
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });

/** One ribbon from the pond's bank along the stream, over the lip and down the fall. */
function flowGeometry(terrain: Terrain): THREE.BufferGeometry {
  const { points, halfWidth } = terrain.stream;
  const positions: number[] = [];
  const flow: number[] = [];
  const indices: number[] = [];
  const centre: THREE.Vector3[] = [];
  const marks: number[] = [];
  let travelled = 0;
  points.forEach(([x, z], index) => {
    if (index > 0) {
      const [px, pz] = points[index - 1] as [number, number];
      travelled += Math.hypot(x - px, z - pz);
    }
    const last = index === points.length - 1;
    // Water lies a little above the carved bed; at the lip it follows the turf over the edge.
    centre.push(new THREE.Vector3(x, terrain.height(x, z) + (last ? 0.1 : 0.075), z));
    marks.push(travelled);
  });
  // The fall: out from the rim in an arc, then straight down.
  const out = new THREE.Vector3(Math.cos(terrain.outlet.angle), 0, Math.sin(terrain.outlet.angle));
  const lip = centre[centre.length - 1] as THREE.Vector3;
  const drops = [
    [0.12, -0.04],
    [0.22, -0.2],
    [0.28, -0.55],
    [0.3, -1.2],
    [0.3, -2.1],
    [0.3, -3.2],
  ] as const;
  for (const [reach, fall] of drops) {
    centre.push(
      lip
        .clone()
        .addScaledVector(out, reach)
        .setY(lip.y + fall),
    );
    marks.push(100 - fall);
  }

  const across = new THREE.Vector3(-out.z, 0, out.x);
  centre.forEach((point, index) => {
    const falling = (marks[index] as number) >= 100;
    const width = halfWidth * (falling ? 1.25 : 1.15);
    for (const side of [-1, 1]) {
      positions.push(point.x + across.x * side * width, point.y, point.z + across.z * side * width);
      flow.push(side, marks[index] as number);
    }
    if (index > 0) {
      const a = (index - 1) * 2;
      indices.push(a, a + 1, a + 3, a, a + 3, a + 2);
    }
  });
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('aFlow', new THREE.Float32BufferAttribute(flow, 2));
  geometry.setIndex(indices);
  return geometry;
}

const light = new THREE.Color();

export function Water() {
  const seed = useScene((state) => state.seed);
  const quality = useWorldStore((state) => state.quality);
  const terrain = useMemo(() => createTerrain(seed), [seed]);
  const pond = useMemo(() => pondMaterial(), []);
  const flow = useMemo(() => flowMaterial(), []);
  const disc = useMemo(() => new THREE.CircleGeometry(1, 40), []);
  const ribbon = useMemo(() => flowGeometry(terrain), [terrain]);
  useDispose(pond);
  useDispose(flow);
  useDispose(disc);
  useDispose(ribbon);

  useFrame(() => {
    // Unlit water still has to follow the day: dim and blue at night, warm at dusk.
    const { atmosphere } = live;
    const level = 0.32 + 0.3 * atmosphere.fillIntensity + 0.16 * atmosphere.lightIntensity;
    light.setRGB(
      (atmosphere.skyFill[0] * 0.55 + atmosphere.lightColor[0] * 0.45) * level,
      (atmosphere.skyFill[1] * 0.55 + atmosphere.lightColor[1] * 0.45) * level,
      (atmosphere.skyFill[2] * 0.55 + atmosphere.lightColor[2] * 0.45) * level,
      THREE.SRGBColorSpace,
    );
    (pond.uniforms.uLight as THREE.IUniform<THREE.Color>).value.copy(light);
    (flow.uniforms.uLight as THREE.IUniform<THREE.Color>).value.copy(light);
    const drop = (pond.uniforms.uDrop as THREE.IUniform<THREE.Vector4>).value;
    drop.z += live.dt;
  });

  const radius = terrain.pond.radius * 1.16;
  const mist = QUALITY[quality].motes;
  return (
    <group>
      <mesh
        name="pond"
        geometry={disc}
        material={pond}
        position={[terrain.pond.x, terrain.pond.level, terrain.pond.z]}
        rotation-x={-Math.PI / 2}
        scale={radius}
      />
      <mesh geometry={ribbon} material={flow} renderOrder={2} />
      {mist > 0 && (
        <Sparkles
          count={Math.round(mist * 0.6)}
          position={[
            terrain.outlet.x + Math.cos(terrain.outlet.angle) * 0.3,
            terrain.outlet.y - 2.4,
            terrain.outlet.z + Math.sin(terrain.outlet.angle) * 0.3,
          ]}
          scale={[0.7, 1.6, 0.7]}
          size={2.4}
          speed={0.5}
          opacity={0.75}
          color="#ffffff"
        />
      )}
    </group>
  );
}
