'use client';

import { Float } from '@react-three/drei';
import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { QUALITY } from '../config';
import { useWorldStore } from '../store';
import { createTerrain } from '../terrain';
import { rockGeometry as boulderGeometry, stoneGeometry } from './geometry';
import { lawnGeometry, rockGeometry } from './islandGeometry';
import { toyMaterial } from './materials';
import { applyInstances, scatterIsland } from './scatter';
import { useDispose, useScene } from './sceneStore';

/** A chunk of the island that broke off and drifts beside it: rock below, turf on top. */
function drifterGeometry(): THREE.BufferGeometry {
  const rock = boulderGeometry(11, 1);
  const position = rock.getAttribute('position') as THREE.BufferAttribute;
  const colours = new Float32Array(position.count * 3);
  const turf = new THREE.Color('#5fc866');
  const stone = new THREE.Color('#cfa679');
  const dark = new THREE.Color('#a57a50');
  const colour = new THREE.Color();
  for (let face = 0; face < position.count; face += 3) {
    // Pull the lower half into a point and flatten the top, facet by facet.
    let top = 0;
    for (let k = 0; k < 3; k += 1) {
      const y = position.getY(face + k);
      if (y < 0) {
        const pinch = 1 + y * 0.55;
        position.setXYZ(
          face + k,
          position.getX(face + k) * pinch,
          y * 1.7,
          position.getZ(face + k) * pinch,
        );
      } else {
        position.setY(face + k, y * 0.35);
      }
      top += position.getY(face + k);
    }
    colour.copy(top > 0.12 ? turf : top > -1.2 ? stone : dark);
    for (let k = 0; k < 3; k += 1) colour.toArray(colours, (face + k) * 3);
  }
  rock.setAttribute('color', new THREE.BufferAttribute(colours, 3));
  rock.computeVertexNormals();
  return rock;
}

const DRIFTERS = [
  { position: [-4.5, -0.5, -1.4], scale: 0.52, speed: 1.1, turn: 0.4 },
  { position: [4.3, 0.5, -2.3], scale: 0.36, speed: 1.5, turn: 2.1 },
  { position: [3.5, -1.9, 1.3], scale: 0.24, speed: 1.9, turn: 4.0 },
  { position: [-3.3, -2.1, 1.7], scale: 0.2, speed: 1.7, turn: 5.2 },
] as const;

/** The ground: lawn, rock underside, stepping stones, boulders and a few drifting chunks. */
export function Island() {
  const seed = useScene((state) => state.seed);
  const quality = useWorldStore((state) => state.quality);
  const tier = QUALITY[quality];
  const terrain = useMemo(() => createTerrain(seed), [seed]);

  const lawn = useMemo(() => lawnGeometry(terrain, tier.islandSegments), [terrain, tier]);
  const rock = useMemo(() => rockGeometry(terrain, tier.islandSegments), [terrain, tier]);
  const lawnMaterial = useMemo(() => toyMaterial({ vertexColors: true }, { mood: true }), []);
  const rockMaterial = useMemo(() => toyMaterial({ vertexColors: true, flatShading: true }), []);
  const boulder = useMemo(() => boulderGeometry(5), []);
  const boulderMaterial = useMemo(() => toyMaterial({ flatShading: true }), []);
  const stone = useMemo(() => stoneGeometry(), []);
  const drifter = useMemo(() => drifterGeometry(), []);
  useDispose(lawn);
  useDispose(rock);
  useDispose(lawnMaterial);
  useDispose(rockMaterial);
  useDispose(boulder);
  useDispose(boulderMaterial);
  useDispose(stone);
  useDispose(drifter);

  const scatter = useMemo(() => scatterIsland(terrain, { tufts: 1, flowers: 1 }), [terrain]);
  const boulders = useRef<THREE.InstancedMesh>(null);
  const stones = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    if (boulders.current) applyInstances(boulders.current, scatter.rocks, scatter.rocks.count);
    if (stones.current) applyInstances(stones.current, scatter.stones, scatter.stones.count);
  }, [scatter]);

  return (
    <group>
      <mesh geometry={lawn} material={lawnMaterial} castShadow receiveShadow />
      <mesh geometry={rock} material={rockMaterial} castShadow receiveShadow />
      <instancedMesh
        ref={boulders}
        args={[boulder, boulderMaterial, Math.max(1, scatter.rocks.count)]}
        castShadow
        receiveShadow
      />
      <instancedMesh
        ref={stones}
        args={[stone, boulderMaterial, Math.max(1, scatter.stones.count)]}
        receiveShadow
      />
      {DRIFTERS.slice(0, tier.clouds > 4 ? 4 : 2).map((item) => (
        <Float
          key={item.turn}
          speed={item.speed}
          rotationIntensity={0.25}
          floatIntensity={0.6}
          floatingRange={[-0.12, 0.12]}
        >
          <mesh
            geometry={drifter}
            material={rockMaterial}
            position={item.position}
            rotation-y={item.turn}
            scale={item.scale}
            castShadow={false}
          />
        </Float>
      ))}
    </group>
  );
}
