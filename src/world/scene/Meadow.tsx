'use client';

import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { QUALITY } from '../config';
import { useWorldStore } from '../store';
import { createTerrain } from '../terrain';
import { flowerHeadGeometry, puffGeometry, stemGeometry, tuftGeometry } from './geometry';
import { toyMaterial } from './materials';
import { MEADOW } from './palette';
import { applyInstances, scatterIsland } from './scatter';
import { useDispose, useScene } from './sceneStore';

/**
 * What grows on the island: grass tufts, the turf that hangs over its rim, flowers and
 * rim bushes. Five instanced meshes, five draw calls; all of it sways in the vertex
 * shader and none of it costs CPU per frame. Grass and flowers neither cast shadows nor
 * sample the shadow map (thousands of blades doing either would cost more than the rest
 * of the scene): they darken under the crown from the shared shadow blob instead.
 */
export function Meadow() {
  const seed = useScene((state) => state.seed);
  const quality = useWorldStore((state) => state.quality);
  const tier = QUALITY[quality];
  const terrain = useMemo(() => createTerrain(seed), [seed]);
  const scatter = useMemo(
    () => scatterIsland(terrain, { tufts: tier.grassTufts, flowers: tier.flowers }),
    [terrain, tier],
  );

  const tuft = useMemo(() => tuftGeometry(), []);
  const hang = useMemo(() => tuftGeometry(true), []);
  const stem = useMemo(() => stemGeometry(), []);
  const head = useMemo(() => flowerHeadGeometry(), []);
  const bush = useMemo(() => puffGeometry(2, 9, 0.3), []);
  const grassMaterial = useMemo(
    () =>
      toyMaterial(
        { color: '#ffffff', side: THREE.DoubleSide },
        {
          sway: 'grass',
          mood: true,
          baseShade: 0.78,
          tipShade: 1.16,
          uplit: true,
          crownShade: true,
        },
      ),
    [],
  );
  const stemMaterial = useMemo(
    () =>
      toyMaterial(
        { color: MEADOW.stem, side: THREE.DoubleSide },
        { sway: 'grass', mood: true, uplit: true, crownShade: true },
      ),
    [],
  );
  const headMaterial = useMemo(
    () =>
      toyMaterial(
        { vertexColors: true, side: THREE.DoubleSide },
        { sway: 'grass', uplit: true, crownShade: true },
      ),
    [],
  );
  const bushMaterial = useMemo(
    () => toyMaterial({ color: '#ffffff' }, { mood: true, rim: 0.5 }),
    [],
  );
  useDispose(tuft);
  useDispose(hang);
  useDispose(stem);
  useDispose(head);
  useDispose(bush);
  useDispose(grassMaterial);
  useDispose(stemMaterial);
  useDispose(headMaterial);
  useDispose(bushMaterial);

  const grass = useRef<THREE.InstancedMesh>(null);
  const stems = useRef<THREE.InstancedMesh>(null);
  const heads = useRef<THREE.InstancedMesh>(null);
  const bushes = useRef<THREE.InstancedMesh>(null);
  const turf = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    if (turf.current) applyInstances(turf.current, scatter.hanging, scatter.hanging.count);
    if (grass.current) applyInstances(grass.current, scatter.tufts, scatter.tufts.count);
    if (heads.current) applyInstances(heads.current, scatter.flowers, scatter.flowers.count);
    if (bushes.current) applyInstances(bushes.current, scatter.bushes, scatter.bushes.count);
    const stalks = stems.current;
    if (stalks) {
      // Stems share the flowers' places but keep their own green.
      const shown = Math.min(scatter.flowers.count, stalks.instanceMatrix.count);
      (stalks.instanceMatrix.array as Float32Array).set(
        scatter.flowers.matrices.subarray(0, shown * 16),
      );
      stalks.instanceMatrix.needsUpdate = true;
      stalks.count = shown;
      stalks.computeBoundingSphere();
    }
  }, [scatter]);

  return (
    <group>
      <instancedMesh ref={grass} args={[tuft, grassMaterial, Math.max(1, scatter.tufts.count)]} />
      <instancedMesh ref={turf} args={[hang, grassMaterial, Math.max(1, scatter.hanging.count)]} />
      <instancedMesh ref={stems} args={[stem, stemMaterial, Math.max(1, scatter.flowers.count)]} />
      <instancedMesh ref={heads} args={[head, headMaterial, Math.max(1, scatter.flowers.count)]} />
      <instancedMesh
        ref={bushes}
        args={[bush, bushMaterial, Math.max(1, scatter.bushes.count)]}
        castShadow
        receiveShadow
      />
    </group>
  );
}
