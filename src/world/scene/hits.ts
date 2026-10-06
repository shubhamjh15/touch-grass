import { useEffect, type RefObject } from 'react';
import * as THREE from 'three';
import type { WorldHit } from '../interaction';

/**
 * Hit-testing: which named part of the world is under a point of the screen.
 *
 * The page content sits *above* the canvas, so three's and R3F's own pointer events
 * never fire. Instead the stage forwards pointer positions, and this module casts one
 * ray against the registered targets: at most once per frame, and only when the pointer
 * moved. A target is any object (or group) registered under a part name; cheap invisible
 * proxies are preferred over detailed meshes.
 *
 * To make something hoverable and tappable, call `useHitTarget('prop:bench', ref)` in
 * its component, then listen with `onWorldTap` / `onWorldHover` from `interaction.ts`.
 */

const targets: THREE.Object3D[] = [];
const names = new Map<THREE.Object3D, string>();
const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();
const results: THREE.Intersection[] = [];

/** Registers `object` (and everything under it) as the part `name`. Returns the undo. */
export function registerHitTarget(name: string, object: THREE.Object3D): () => void {
  targets.push(object);
  names.set(object, name);
  return () => {
    const index = targets.indexOf(object);
    if (index >= 0) targets.splice(index, 1);
    names.delete(object);
  };
}

/** Registers the object a ref points at for as long as the component is mounted. */
export function useHitTarget(name: string, ref: RefObject<THREE.Object3D | null>): void {
  useEffect(() => {
    const object = ref.current;
    if (!object) return;
    return registerHitTarget(name, object);
  }, [name, ref]);
}

function partOf(object: THREE.Object3D | null): string | null {
  for (let node = object; node; node = node.parent) {
    const name = names.get(node);
    if (name !== undefined) return name;
  }
  return null;
}

/**
 * The nearest registered part under a point of the stage, or `null`. `u` and `v` run
 * 0..1 across and down the stage box, which the canvas fills.
 */
export function hitTest(
  u: number,
  v: number,
  camera: THREE.Camera,
  clientX: number,
  clientY: number,
): WorldHit | null {
  if (targets.length === 0) return null;
  ndc.set(u * 2 - 1, 1 - v * 2);
  if (Math.abs(ndc.x) > 1 || Math.abs(ndc.y) > 1) return null;
  raycaster.setFromCamera(ndc, camera);
  results.length = 0;
  raycaster.intersectObjects(targets, true, results);
  for (const result of results) {
    const part = partOf(result.object);
    if (part === null) continue;
    return {
      part,
      point: [result.point.x, result.point.y, result.point.z],
      clientX,
      clientY,
    };
  }
  return null;
}
