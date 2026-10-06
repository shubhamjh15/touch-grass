'use client';

import { useMemo, type ReactNode } from 'react';
import { anchorsFor, type AnchorId } from '../anchors';
import { useScene } from './sceneStore';

/**
 * Stands its children on a named place of the island: at the anchor's position on the
 * lawn, turned the way the layout turned it. Mount it inside `<IslandGroup>` so whatever
 * it holds hops, dips and bobs with the island.
 *
 *   <Slot id="bench"><BenchModel /></Slot>
 */
export function Slot({ id, children }: { id: AnchorId; children: ReactNode }) {
  const seed = useScene((state) => state.seed);
  const anchor = useMemo(() => anchorsFor(seed)[id], [seed, id]);
  return (
    <group position={[anchor.x, anchor.y, anchor.z]} rotation-y={anchor.yaw}>
      {children}
    </group>
  );
}
