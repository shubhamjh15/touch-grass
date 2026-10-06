'use client';

import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { clamp01, damp, lerp } from '@/lib/math';
import { play } from '@/lib/sfx';
import { anchorsFor, type Anchor, type AnchorId } from '../anchors';
import { LANDMARKS, type LandmarkId } from '../contract';
import { onWorldTap } from '../interaction';
import { layoutIsland } from '../props/layout';
import { terrainHeight } from '../terrain';
import { spawnBurst } from './burstBus';
import { useHitTarget } from './hits';
import { live, shared } from './live';
import { toyMaterial } from './materials';
import {
  disposeModel,
  flowerBed,
  landmarkModel,
  propModel,
  type GroundModelId,
  type PropModel,
} from './propModels';
import { useDispose, useScene } from './sceneStore';

/**
 * Everything that stands on the island: the seven landmarks (always there) and the props
 * the user has earned. Each is one mesh at its anchor of the seeded layout, sharing one
 * material. A prop that is earned while the user watches drops in like a sticker; every
 * one lifts under the pointer and wobbles when tapped.
 */

/** Toys are drawn a little larger than their footprints: they are small next to the tree. */
const TOY_SCALE = 1.1;
const DROP_SECONDS = 0.34;

const GROUND: readonly GroundModelId[] = [
  'mushrooms',
  'pond',
  'bench',
  'lantern',
  'turbine',
  'solar',
  'compost',
  'veggie-patch',
  'beehive',
  'birdhouse',
  'swing',
  'signpost',
];

/** Where each part stands, for the hover ring and for anything that wants to find it. */
const places = new Map<string, { x: number; y: number; z: number; radius: number }>();

const DAY_GLASS = new THREE.Color(1, 0.9, 0.55);
const LIT_GLASS = new THREE.Color(3, 2.3, 0.9);

interface ToyProps {
  part: string;
  anchor: Anchor;
  model: PropModel;
  material: THREE.Material;
  shadows: boolean;
}

function Toy({ part, anchor, model, material, shadows }: ToyProps) {
  const outer = useRef<THREE.Group>(null);
  const inner = useRef<THREE.Group>(null);
  const moving = useRef<THREE.Mesh>(null);
  const state = useRef({ hover: 0, landed: false, lit: 0, spin: 0 });
  const glass = useMemo(
    () => (model.glow ? new THREE.MeshBasicMaterial({ color: DAY_GLASS.clone() }) : null),
    [model.glow],
  );
  const halo = useMemo(() => {
    if (!model.glow) return null;
    // A pool of light on the lawn: bright in the middle, nothing at its edge.
    const disc = new THREE.CircleGeometry(0.75, 16);
    const count = disc.getAttribute('position').count;
    const colours = new Float32Array(count * 3);
    colours.set([1, 0.82, 0.4], 0);
    disc.setAttribute('color', new THREE.BufferAttribute(colours, 3));
    return {
      disc,
      material: new THREE.MeshBasicMaterial({
        vertexColors: true,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        opacity: 0,
      }),
    };
  }, [model.glow]);
  useEffect(
    () => () => {
      glass?.dispose();
      halo?.disc.dispose();
      halo?.material.dispose();
    },
    [glass, halo],
  );
  useHitTarget(part, outer);

  useEffect(() => {
    places.set(part, { x: anchor.x, y: anchor.y, z: anchor.z, radius: anchor.radius });
    return () => {
      places.delete(part);
    };
  }, [part, anchor]);

  useFrame((three) => {
    const root = outer.current;
    const body = inner.current;
    if (!root || !body) return;
    const local = state.current;
    const { time, dt, channels, tree } = live;

    // Arrival: a fall, a landing with a pop, a star of paper chips.
    let lift = 0;
    let lean = 0;
    let scale = 1;
    const arrived = live.arrived.get(part);
    if (arrived !== undefined) {
      const since = time - arrived;
      body.visible = since >= 0;
      if (since >= 0 && since < 1.2) {
        const fall = clamp01(since / DROP_SECONDS);
        lift = (1 - fall * fall) * (1.1 + model.height * 0.3);
        lean = (1 - fall) * -0.14;
        const landed = since - DROP_SECONDS;
        if (landed >= 0) {
          scale = 1 + 0.1 * Math.exp(-landed * 8) * Math.cos(landed * 21);
          if (!local.landed) {
            local.landed = true;
            spawnBurst('chips', 8, [anchor.x, anchor.y + 0.08, anchor.z]);
            play('stick');
          }
        }
      }
    } else {
      body.visible = true;
    }

    // Under the pointer it lifts a little; a tap makes it wobble.
    local.hover = damp(local.hover, live.hover === part ? 1 : 0, 14, dt);
    lift += local.hover * 0.07;
    scale *= 1 + local.hover * 0.07;
    let squash = 1;
    const tapped = live.tapped.get(part);
    const sinceTap = tapped === undefined ? 9 : time - tapped;
    if (sinceTap < 1.1 && !live.reduced) {
      squash = 1 - 0.2 * Math.exp(-sinceTap * 6) * Math.cos(sinceTap * 23);
      lean += 0.11 * Math.exp(-sinceTap * 4.5) * Math.sin(sinceTap * 19);
    }

    let x = anchor.x;
    let y = anchor.y;
    let z = anchor.z;
    let yaw = anchor.yaw;
    let pitch = 0;
    if (part === 'landmark:log') {
      // The watering can rises over the foot of the tree and tips (the `water` pulse).
      const can = channels.can;
      if (can > 0) {
        x = lerp(x, tree.x - 0.42, can);
        y = lerp(y, tree.y + Math.min(1.5, 0.75 + tree.top * 0.2), can);
        z = lerp(z, tree.z + 0.32, can);
        yaw *= 1 - can;
        lean -= can * 0.95;
      }
    } else if (part === 'landmark:impact') {
      scale *= 1 + channels.stamp;
    } else if (part === 'landmark:coach') {
      // Moss breathes, turns to whoever is looking, and bounces when there is news.
      lift += channels.cheer * 0.34;
      squash *= 1 + Math.sin(time * 1.3) * 0.018 - channels.cheer * 0.06;
      const towards = Math.atan2(three.camera.position.x - x, three.camera.position.z - z);
      yaw = Math.max(-0.7, Math.min(0.7, towards));
    } else if (part === 'landmark:me') {
      // The passport hangs on the trunk and grows up with it.
      const girth = 0.1 + 0.3 * live.growth;
      x = tree.x + 0.02;
      y = tree.y + Math.min(1.1, 0.42 + tree.top * 0.16);
      z = tree.z + girth + 0.03;
      yaw = 0;
      pitch = -0.06;
      lean += live.reduced ? 0 : Math.sin(time * 1.4) * 0.05;
      body.visible = body.visible && live.growth > 0.1;
    }

    root.position.set(x, y, z);
    root.rotation.set(pitch, yaw, 0);
    body.position.y = lift;
    body.rotation.z = lean;
    const wide = scale / Math.sqrt(squash);
    body.scale.set(wide * TOY_SCALE, scale * squash * TOY_SCALE, wide * TOY_SCALE);

    const part2 = moving.current;
    if (part2 && model.moving) {
      const calm = live.reduced ? 0.25 : 1;
      if (model.moving.motion === 'spin') {
        local.spin += dt * (0.9 + shared.uWind.value.z * 1.6) * calm;
        part2.rotation.z = local.spin;
      } else if (model.moving.motion === 'swing') {
        const push = sinceTap < 4 ? 1 + 2.2 * Math.exp(-sinceTap * 0.9) : 1;
        part2.rotation.x = Math.sin(time * 1.8) * 0.16 * push * calm;
      } else {
        const turn = time * 0.22 * calm;
        part2.position.set(
          Math.cos(turn) * 0.2,
          Math.sin(time * 2.1) * 0.006,
          Math.sin(turn) * 0.15,
        );
        part2.rotation.y = -turn;
      }
    }

    if (glass && halo) {
      const lit = live.hour >= 17.5 || live.hour < 6.5 ? 1 : 0;
      local.lit = damp(local.lit, lit, 3, dt);
      glass.color.copy(DAY_GLASS).lerp(LIT_GLASS, local.lit);
      halo.material.opacity = local.lit * (0.2 + 0.5 * live.atmosphere.night);
    }
  });

  return (
    <group ref={outer} position={[anchor.x, anchor.y, anchor.z]} rotation-y={anchor.yaw}>
      <group ref={inner}>
        <mesh
          geometry={model.body}
          material={material}
          castShadow={shadows}
          receiveShadow={shadows}
        />
        {model.moving && (
          <mesh
            ref={moving}
            geometry={model.moving.geometry}
            material={material}
            position={model.moving.pivot}
            castShadow={shadows}
          />
        )}
        {model.glow && glass && <mesh geometry={model.glow} material={glass} />}
      </group>
      {halo && (
        <mesh
          geometry={halo.disc}
          material={halo.material}
          rotation-x={-Math.PI / 2}
          position-y={0.03}
          renderOrder={2}
        />
      )}
    </group>
  );
}

function Landmark({
  id,
  seed,
  rings,
  material,
  shadows,
}: {
  id: LandmarkId;
  seed: number;
  rings: number;
  material: THREE.Material;
  shadows: boolean;
}) {
  const count = id === 'impact' ? rings : 0;
  const model = useMemo(() => landmarkModel(id, count), [id, count]);
  useEffect(() => () => disposeModel(model), [model]);
  const anchor = useMemo(() => anchorsFor(seed)[id], [seed, id]);
  return (
    <Toy
      part={`landmark:${id}`}
      anchor={anchor}
      model={model}
      material={material}
      shadows={shadows}
    />
  );
}

function GroundProp({
  id,
  seed,
  material,
  shadows,
}: {
  id: GroundModelId;
  seed: number;
  material: THREE.Material;
  shadows: boolean;
}) {
  const model = useMemo(() => propModel(id), [id]);
  useEffect(() => () => disposeModel(model), [model]);
  const anchor = useMemo(() => anchorsFor(seed)[id as AnchorId], [seed, id]);
  return (
    <Toy part={`prop:${id}`} anchor={anchor} model={model} material={material} shadows={shadows} />
  );
}

/** The earned flowers: one mesh at the nine places the layout keeps for them. */
function Flowers({ seed, material }: { seed: number; material: THREE.Material }) {
  const mesh = useRef<THREE.Mesh>(null);
  const spots = useMemo(
    () =>
      layoutIsland(seed).flowers.map((spot) => ({
        ...spot,
        // The layout's own heights predate the rolling lawn: ask the terrain.
        y: terrainHeight(seed, spot.x, spot.z),
      })),
    [seed],
  );
  const geometry = useMemo(() => flowerBed(spots), [spots]);
  useDispose(geometry);
  useHitTarget('prop:flowers', mesh);
  const state = useRef({ hover: 0 });

  useEffect(() => {
    const first = spots[0];
    if (first) places.set('prop:flowers', { x: first.x, y: first.y, z: first.z, radius: 0.2 });
    return () => {
      places.delete('prop:flowers');
    };
  }, [spots]);

  useFrame(() => {
    const node = mesh.current;
    if (!node) return;
    // They open from the ground when they are earned, and stretch a little when tapped.
    const arrived = live.arrived.get('prop:flowers');
    const since = arrived === undefined ? 9 : live.time - arrived;
    let grow = 1;
    if (since < 1.2) {
      const t = clamp01(since / 0.5);
      grow = since < 0 ? 0 : t * (1 + 0.25 * Math.exp(-since * 5) * Math.sin(since * 14));
    }
    const tapped = live.tapped.get('prop:flowers');
    const sinceTap = tapped === undefined ? 9 : live.time - tapped;
    if (sinceTap < 1 && !live.reduced) {
      grow *= 1 + 0.14 * Math.exp(-sinceTap * 5) * Math.sin(sinceTap * 20);
    }
    state.current.hover = damp(
      state.current.hover,
      live.hover === 'prop:flowers' ? 1 : 0,
      14,
      live.dt,
    );
    node.scale.set(1, Math.max(0.001, grow) * (1 + state.current.hover * 0.12), 1);
  });

  return <mesh ref={mesh} geometry={geometry} material={material} />;
}

/** A soft ring on the lawn under whatever the pointer is on. */
function HoverRing() {
  const mesh = useRef<THREE.Mesh>(null);
  const geometry = useMemo(() => new THREE.RingGeometry(0.82, 1, 28), []);
  const material = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: '#ffffff',
        transparent: true,
        opacity: 0,
        depthWrite: false,
      }),
    [],
  );
  useDispose(geometry);
  useDispose(material);
  const shown = useRef(0);

  useFrame(() => {
    const node = mesh.current;
    if (!node) return;
    const place = live.hover ? places.get(live.hover) : undefined;
    shown.current = damp(shown.current, place ? 1 : 0, 12, live.dt);
    node.visible = shown.current > 0.02;
    if (!node.visible) return;
    if (place) {
      const radius = (place.radius + 0.08) * TOY_SCALE;
      node.position.set(place.x, place.y + 0.035, place.z);
      node.scale.setScalar(radius * (1 + (live.reduced ? 0 : Math.sin(live.time * 5) * 0.03)));
    }
    material.opacity = shown.current * 0.75;
  });

  return (
    <mesh
      ref={mesh}
      geometry={geometry}
      material={material}
      rotation-x={-Math.PI / 2}
      visible={false}
    />
  );
}

export function Props({ shadows }: { shadows: boolean }) {
  const seed = useScene((state) => state.seed);
  const key = useScene((state) => state.props);
  const rings = useScene((state) => state.rings);
  const owned = useMemo(() => new Set(key ? key.split(',') : []), [key]);
  const material = useMemo(() => toyMaterial({ vertexColors: true }, { sway: 'grass' }), []);
  useDispose(material);

  // A tap on a toy: it wobbles (each one reads its own time), and says so quietly.
  useEffect(
    () =>
      onWorldTap((hit) => {
        if (!hit.part.startsWith('prop:') && !hit.part.startsWith('landmark:')) return;
        live.tapped.set(hit.part, live.time);
        play(hit.part === 'landmark:coach' ? 'cheer' : 'tap');
      }),
    [],
  );

  return (
    <group>
      {LANDMARKS.map((id) => (
        <Landmark
          key={id}
          id={id}
          seed={seed}
          rings={rings}
          material={material}
          shadows={shadows}
        />
      ))}
      {GROUND.filter((id) => owned.has(id)).map((id) => (
        <GroundProp key={id} id={id} seed={seed} material={material} shadows={shadows} />
      ))}
      {owned.has('flowers') && <Flowers seed={seed} material={material} />}
      <HoverRing />
    </group>
  );
}
