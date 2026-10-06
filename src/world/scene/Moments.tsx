'use client';

import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { spawnBurst } from './burstBus';
import { live, shared } from './live';
import { useDispose } from './sceneStore';

/**
 * The set pieces of the pulses (design bible 5.10), driven by the scheduler's channels:
 *
 *   halo    a ring of light spreading over the lawn from the foot of the tree, with a
 *           wave through the grass (grow, level-up, plant, celebrate);
 *   star    the gold star that falls beside the tree and lands with a badge;
 *   spiral  a ribbon of sparks winding up around the tree (level-up, streak).
 *
 * Two small meshes, shown only while their channel runs; the sparks go through the
 * shared burst pool.
 */

function starGeometry(): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  for (let i = 0; i < 10; i += 1) {
    const angle = (i / 10) * Math.PI * 2 + Math.PI / 2;
    const radius = i % 2 === 0 ? 1 : 0.46;
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: 0.28,
    bevelEnabled: true,
    bevelSize: 0.12,
    bevelThickness: 0.12,
    bevelSegments: 1,
  });
  geometry.center();
  return geometry;
}

const at: [number, number, number] = [0, 0, 0];

export function Moments() {
  const halo = useRef<THREE.Mesh>(null);
  const star = useRef<THREE.Mesh>(null);
  const ring = useMemo(() => new THREE.RingGeometry(0.72, 1, 40), []);
  const ringMaterial = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: new THREE.Color(1.9, 1.7, 0.9),
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        opacity: 0,
      }),
    [],
  );
  const starShape = useMemo(starGeometry, []);
  const starMaterial = useMemo(
    () =>
      new THREE.MeshLambertMaterial({
        color: '#facc15',
        emissive: '#f59e0b',
        emissiveIntensity: 0.9,
      }),
    [],
  );
  useDispose(ring);
  useDispose(ringMaterial);
  useDispose(starShape);
  useDispose(starMaterial);
  const state = useRef({ haloOn: false, frame: 0 });

  useFrame(() => {
    const { channels, tree, time } = live;
    const local = state.current;
    local.frame += 1;

    const wave = halo.current;
    if (wave) {
      const spread = live.reduced ? -1 : channels.halo;
      wave.visible = spread >= 0;
      if (wave.visible) {
        // The same moment runs through the grass.
        if (!local.haloOn) shared.uRipple.value.set(tree.x, tree.z, 0, 1);
        wave.position.set(tree.x, tree.y + 0.06, tree.z);
        wave.scale.setScalar(0.35 + spread * 3);
        ringMaterial.opacity = (1 - spread) ** 1.5 * 0.9;
      }
      local.haloOn = wave.visible;
    }

    const medal = star.current;
    if (medal) {
      const fall = live.reduced ? -1 : channels.star;
      medal.visible = fall >= 0 && fall < 2;
      if (medal.visible) {
        const down = Math.min(1, fall);
        const landed = Math.max(0, fall - 1);
        const height = Math.max(1.6, tree.top * 0.7 + 1.2);
        medal.position.set(
          tree.x + 0.95 + (1 - down) * 0.5,
          tree.y + 0.42 + (1 - down) * height,
          tree.z + 0.85,
        );
        medal.rotation.set(0, time * 5 * (1 - landed) + landed * 0.3, (1 - down) * -0.5);
        const pop = landed > 0 ? 1 + Math.sin(Math.min(1, landed * 3) * Math.PI) * 0.45 : 1;
        medal.scale.setScalar(0.3 * pop * (1 - landed ** 3));
      }
    }

    // The ribbon of sparks: two a frame along a double helix that hugs the crown.
    const wind = live.reduced ? -1 : channels.spiral;
    if (wind >= 0 && wind <= 1 && (live.quality !== 'low' || local.frame % 2 === 0)) {
      const angle = wind * Math.PI * 5;
      const radius = 0.3 + tree.halfWidth * 0.75 * Math.sin(Math.min(1, wind * 1.15) * Math.PI);
      at[0] = tree.x + Math.cos(angle) * radius;
      at[1] = tree.y + 0.15 + wind * tree.top * 0.98;
      at[2] = tree.z + Math.sin(angle) * radius;
      spawnBurst('sparks', 1, at);
      at[0] = tree.x - Math.cos(angle) * radius;
      at[2] = tree.z - Math.sin(angle) * radius;
      spawnBurst('sparks', 1, at);
    }
  });

  return (
    <group>
      <mesh
        ref={halo}
        geometry={ring}
        material={ringMaterial}
        rotation-x={-Math.PI / 2}
        visible={false}
        renderOrder={2}
      />
      <mesh ref={star} geometry={starShape} material={starMaterial} visible={false} />
    </group>
  );
}
