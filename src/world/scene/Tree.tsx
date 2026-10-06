'use client';

import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { ISLAND, QUALITY } from '../config';
import { useWorldStore } from '../store';
import { useHitTarget } from './hits';
import { live } from './live';
import { useDispose, useScene } from './sceneStore';
import { TreeRig } from './TreeRig';

/**
 * The tree in the scene graph: the rig that draws it, the band of light that climbs the
 * trunk when a ring is earned, and two invisible proxies for hit-testing (the crown and
 * the lawn), so a pointer ray never has to test thousands of leaves or blades.
 */
export function Tree() {
  const seed = useScene((state) => state.seed);
  const species = useScene((state) => state.species);
  const quality = useWorldStore((state) => state.quality);
  const tier = QUALITY[quality];
  const rig = useMemo(() => new TreeRig(seed, species, tier), [seed, species, tier]);
  useEffect(() => () => rig.dispose(), [rig]);

  const crown = useRef<THREE.Mesh>(null);
  const lawn = useRef<THREE.Mesh>(null);
  const band = useRef<THREE.Mesh>(null);
  useHitTarget('tree', crown);
  useHitTarget('ground', lawn);

  const sphere = useMemo(() => new THREE.SphereGeometry(1, 10, 8), []);
  const slab = useMemo(() => new THREE.CylinderGeometry(ISLAND.radius, ISLAND.radius, 0.3, 20), []);
  const ring = useMemo(() => new THREE.TorusGeometry(1, 0.12, 6, 20), []);
  const ringMaterial = useMemo(
    () => new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 1.9, 0.7), transparent: true }),
    [],
  );
  useDispose(sphere);
  useDispose(slab);
  useDispose(ring);
  useDispose(ringMaterial);

  useFrame(() => {
    rig.update();
    const { tree, channels } = live;
    const proxy = crown.current;
    if (proxy) {
      // Covers the trunk as well: a young tree is a small target, so be generous.
      const reach = Math.max(0.35, tree.halfWidth);
      const height = Math.max(0.45, tree.top * 0.56);
      proxy.position.set(tree.x, tree.y + height, tree.z);
      proxy.scale.set(reach, height, reach);
    }
    const halo = band.current;
    if (halo) {
      halo.visible = channels.band >= 0;
      if (halo.visible) {
        const climb = channels.band;
        const radius = 0.18 + tree.halfWidth * 0.12 * (1 - climb * 0.5);
        halo.position.set(tree.x, tree.y + 0.05 + climb * tree.top * 0.5, tree.z);
        halo.scale.set(radius, radius, radius * 0.6);
        ringMaterial.opacity = Math.min(1, (1 - climb) * 3 + 0.2);
      }
    }
  });

  return (
    <group>
      <primitive object={rig.group} />
      <mesh ref={crown} geometry={sphere} visible={false} />
      <mesh ref={lawn} geometry={slab} position-y={-0.02} visible={false} />
      <mesh
        ref={band}
        geometry={ring}
        material={ringMaterial}
        rotation-x={Math.PI / 2}
        visible={false}
      />
    </group>
  );
}
