import { LANDMARKS } from './contract';

/**
 * Landmark callouts (design bible 4.8 and 5.7): real DOM buttons that follow points of
 * the 3D island. This module is the pure layout maths plus the code that writes
 * positions straight to the elements every frame. No React state changes per frame.
 *
 * Layout rule: chips sit in two columns at the stage's left and right edges; each
 * anchor takes the nearer column; inside a column chips keep the vertical order of
 * their anchors and at least 8 px between them, so leader lines never cross.
 */

export const CALLOUT = {
  /** A landmark hides once it has turned this far to the back, and shows again nearer the front. */
  hideBehind: -0.14,
  showBehind: -0.04,
  /** Stages smaller than this show no callouts at all. */
  minWidth: 300,
  minHeight: 260,
  gap: 8,
  /** Distance of the columns from the stage edges, below and from 768 px of stage width. */
  inset: 12,
  insetWide: 24,
  /** The dot stays at least this far from a chip, or the leader would be a stub. */
  minLeader: 18,
} as const;

/** Whether a stage of this size shows callouts at all. */
export function stageFitsCallouts(width: number, height: number): boolean {
  return width >= CALLOUT.minWidth && height >= CALLOUT.minHeight;
}

/**
 * Whether a landmark is on the near side of the island. `facing` is 1 at the front
 * rim, -1 at the back, and -9 when the object is absent. The two thresholds keep a
 * landmark on the turning edge from flickering.
 */
export function landmarkVisible(wasVisible: boolean, facing: number): boolean {
  if (facing <= -2) return false;
  return facing > (wasVisible ? CALLOUT.hideBehind : CALLOUT.showBehind);
}

export interface ChipSize {
  width: number;
  height: number;
}

/**
 * Places the chips. `anchors` holds x, y per landmark in stage pixels; `out` receives
 * x, y (top-left of the chip) and the side (-1 left, 1 right) per landmark. Entries
 * whose `visible` flag is 0 are skipped. Allocation-free.
 */
export function layoutCallouts(
  anchors: ArrayLike<number>,
  visible: ArrayLike<number>,
  sizes: readonly ChipSize[],
  stage: { width: number; height: number },
  out: Float32Array,
  order: Uint8Array,
): void {
  const count = sizes.length;
  const inset = stage.width >= 768 ? CALLOUT.insetWide : CALLOUT.inset;
  for (const side of [-1, 1] as const) {
    // Collect this column, sorted by anchor height (insertion sort: seven items at most).
    let members = 0;
    for (let i = 0; i < count; i += 1) {
      if (!visible[i]) continue;
      const x = anchors[i * 2] as number;
      const mine = side < 0 ? x < stage.width / 2 : x >= stage.width / 2;
      if (!mine) continue;
      let at = members;
      while (
        at > 0 &&
        (anchors[(order[at - 1] as number) * 2 + 1] as number) > (anchors[i * 2 + 1] as number)
      ) {
        order[at] = order[at - 1] as number;
        at -= 1;
      }
      order[at] = i;
      members += 1;
    }
    if (members === 0) continue;

    // Each chip wants to sit level with its anchor; push down to keep the gap...
    let floor = inset;
    for (let n = 0; n < members; n += 1) {
      const i = order[n] as number;
      const size = sizes[i] as ChipSize;
      const wanted = (anchors[i * 2 + 1] as number) - size.height / 2;
      const y = Math.max(wanted, floor);
      out[i * 3 + 1] = y;
      floor = y + size.height + CALLOUT.gap;
    }
    // ...then push back up from the bottom edge if the column ran out of room.
    let ceiling = stage.height - inset;
    for (let n = members - 1; n >= 0; n -= 1) {
      const i = order[n] as number;
      const size = sizes[i] as ChipSize;
      const y = Math.min(out[i * 3 + 1] as number, ceiling - size.height);
      out[i * 3 + 1] = Math.max(inset, y);
      ceiling = y - CALLOUT.gap;
    }
    for (let n = 0; n < members; n += 1) {
      const i = order[n] as number;
      const size = sizes[i] as ChipSize;
      out[i * 3] = side < 0 ? inset : stage.width - inset - size.width;
      out[i * 3 + 2] = side;
    }
  }
}

// --- DOM side ------------------------------------------------------------------------------

export interface CalloutElements {
  /** Positioned wrapper of the chip. */
  wrap: HTMLElement;
  line: SVGLineElement;
  dot: SVGCircleElement;
}

interface Registration {
  items: CalloutElements[];
  sizes: ChipSize[];
  shown: Uint8Array;
  /** Last written values, to skip writes that would change nothing. */
  written: Float32Array;
}

const registry = new Map<string, Registration>();
const COUNT = LANDMARKS.length;
const local = new Float32Array(COUNT * 2);
const visible = new Uint8Array(COUNT);
const placed = new Float32Array(COUNT * 3);
const order = new Uint8Array(COUNT);
let lastStage: string | null = null;

/** A stage hands over its callout elements, in `LANDMARKS` order. Returns the undo. */
export function registerCallouts(stageId: string, items: CalloutElements[]): () => void {
  const registration: Registration = {
    items,
    sizes: items.map(() => ({ width: 0, height: 0 })),
    shown: new Uint8Array(items.length),
    written: new Float32Array(items.length * 4).fill(Number.NaN),
  };
  registry.set(stageId, registration);
  measureCallouts(stageId);
  hide(registration);
  return () => {
    if (registry.get(stageId) === registration) registry.delete(stageId);
    if (lastStage === stageId) lastStage = null;
  };
}

/** Re-reads the chip sizes (after a resize or a label change). */
export function measureCallouts(stageId: string): void {
  const registration = registry.get(stageId);
  if (!registration) return;
  registration.items.forEach((item, index) => {
    const size = registration.sizes[index] as ChipSize;
    size.width = item.wrap.offsetWidth;
    size.height = item.wrap.offsetHeight;
  });
  registration.written.fill(Number.NaN);
}

function hide(registration: Registration): void {
  registration.items.forEach((item, index) => {
    if (!registration.shown[index] && item.wrap.style.visibility === 'hidden') return;
    item.wrap.style.visibility = 'hidden';
    item.line.style.visibility = 'hidden';
    item.dot.style.visibility = 'hidden';
    registration.shown[index] = 0;
  });
}

/** Hides the callouts of every stage (the 3D scene went away). */
export function hideAllCallouts(): void {
  registry.forEach(hide);
  lastStage = null;
}

export interface CalloutFrame {
  stageId: string | null;
  /** Box of the stage relative to the canvas, and whether the world is locked to it. */
  box: { x: number; y: number; width: number; height: number };
  locked: boolean;
  reducedMotion: boolean;
}

/**
 * Called by the scene once per frame with the projected anchors (canvas x, canvas y,
 * facing per landmark). Moves the chips, leaders and dots of the active stage, and
 * hides those of a stage the world has left.
 */
export function writeCallouts(frame: CalloutFrame, anchors: Float32Array): void {
  if (lastStage && lastStage !== frame.stageId) {
    const previous = registry.get(lastStage);
    if (previous) hide(previous);
  }
  lastStage = frame.stageId;
  const registration = frame.stageId ? registry.get(frame.stageId) : undefined;
  if (!registration) return;
  const { box } = frame;
  if (!frame.locked || !stageFitsCallouts(box.width, box.height)) {
    hide(registration);
    return;
  }

  const { items, sizes, shown, written } = registration;
  for (let i = 0; i < COUNT; i += 1) {
    const x = (anchors[i * 3] as number) - box.x;
    const y = (anchors[i * 3 + 1] as number) - box.y;
    local[i * 2] = x;
    local[i * 2 + 1] = y;
    const inside = x > 4 && x < box.width - 4 && y > 4 && y < box.height - 4;
    const size = sizes[i] as ChipSize;
    visible[i] =
      inside && size.width > 0 && landmarkVisible(shown[i] === 1, anchors[i * 3 + 2] as number)
        ? 1
        : 0;
  }
  layoutCallouts(local, visible, sizes, box, placed, order);

  for (let i = 0; i < COUNT; i += 1) {
    const item = items[i];
    if (!item) continue;
    if (!visible[i]) {
      if (shown[i]) {
        item.wrap.style.visibility = 'hidden';
        item.line.style.visibility = 'hidden';
        item.dot.style.visibility = 'hidden';
        shown[i] = 0;
      }
      continue;
    }
    const size = sizes[i] as ChipSize;
    const x = Math.round((placed[i * 3] as number) * 2) / 2;
    const y = Math.round((placed[i * 3 + 1] as number) * 2) / 2;
    const ax = Math.round((local[i * 2] as number) * 2) / 2;
    const ay = Math.round((local[i * 2 + 1] as number) * 2) / 2;
    if (written[i * 4] !== x || written[i * 4 + 1] !== y) {
      item.wrap.style.transform = `translate3d(${x}px, ${y}px, 0)`;
      written[i * 4] = x;
      written[i * 4 + 1] = y;
    }
    if (
      written[i * 4 + 2] !== ax ||
      written[i * 4 + 3] !== ay ||
      written[i * 4] !== x ||
      !shown[i]
    ) {
      // The leader leaves from the middle of the chip's inner edge.
      const left = (placed[i * 3 + 2] as number) < 0;
      item.line.setAttribute('x1', String(left ? x + size.width : x));
      item.line.setAttribute('y1', String(y + size.height / 2));
      item.line.setAttribute('x2', String(ax));
      item.line.setAttribute('y2', String(ay));
      item.dot.setAttribute('cx', String(ax));
      item.dot.setAttribute('cy', String(ay));
      written[i * 4 + 2] = ax;
      written[i * 4 + 3] = ay;
    }
    if (!shown[i]) {
      item.wrap.style.visibility = 'visible';
      item.line.style.visibility = 'visible';
      item.dot.style.visibility = 'visible';
      shown[i] = 1;
      // The chip sticks in like every other sticker (spring `pop`), unless motion is reduced.
      if (!frame.reducedMotion && typeof item.wrap.animate === 'function') {
        item.wrap.animate(
          [
            { opacity: 0, scale: '0.82' },
            { opacity: 1, scale: '1.05', offset: 0.6 },
            { opacity: 1, scale: '1' },
          ],
          { duration: 220, delay: i * 28, fill: 'backwards', easing: 'ease-out' },
        );
      }
    }
  }
}
