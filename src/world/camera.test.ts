import { describe, expect, it } from 'vitest';
import { FOV, VIEW, frameShare, viewFor, type View, type ViewInput } from './camera';
import type { StageMode } from './contract';

const MODES: readonly StageMode[] = ['hero', 'hub', 'companion', 'ceremony'];
const blank = (): View => ({
  targetX: 0,
  targetY: 0,
  targetZ: 0,
  distance: 0,
  pitch: 0,
  span: 0,
});

/** A tree that grows from a sprout to an elder, roughly as the skeleton does. */
const treeAt = (growth: number) => ({
  treeTop: 0.3 + growth * 5.2,
  treeHalfWidth: 0.15 + growth * 2.6,
});

const input = (mode: StageMode, growth: number, more: Partial<ViewInput> = {}): ViewInput => ({
  mode,
  aspect: 1.6,
  fit: 0.86,
  anchor: 1,
  growth,
  treeX: 0,
  treeZ: -0.24,
  ...treeAt(growth),
  ...more,
});

/** Share of the stage height between the lowest framed point and the top of the tree. */
function treeShare(view: View, top: number): number {
  const pitch = view.pitch;
  // Height on screen of a point `y` above the target, seen from the pitched camera.
  const screen = (y: number) => ((y - view.targetY) * Math.cos(pitch)) / view.span;
  return 0.5 + screen(top);
}

describe('viewFor', () => {
  it('keeps the tree large at every stage, in every mode', () => {
    for (const mode of MODES) {
      for (const growth of [0.03, 0.07, 0.14, 0.36, 0.66, 0.95]) {
        const view = viewFor(input(mode, growth), blank());
        const { treeTop } = treeAt(growth);
        const height = (Math.max(treeTop, VIEW[mode].minTop) * Math.cos(view.pitch)) / view.span;
        // The tree (or, for a sprout, the patch of lawn it stands in) takes a third of the stage.
        expect(height, `${mode} at ${growth}`).toBeGreaterThan(0.3);
        // And its top is inside the frame.
        expect(treeShare(view, treeTop), `${mode} at ${growth}`).toBeLessThan(1);
      }
    }
  });

  it('pulls back as the tree grows and never jumps', () => {
    for (const mode of MODES) {
      let previous = viewFor(input(mode, 0), blank()).distance;
      for (let growth = 0.01; growth <= 1.0001; growth += 0.01) {
        const distance = viewFor(input(mode, growth), blank()).distance;
        expect(distance).toBeGreaterThanOrEqual(previous - 1e-9);
        expect(distance - previous).toBeLessThan(0.6);
        previous = distance;
      }
    }
  });

  it('keeps the crown below page chrome at the top of the stage', () => {
    for (const growth of [0.14, 0.36, 0.66, 0.95]) {
      const chrome = 0.13;
      const bare = viewFor(input('hub', growth), blank());
      const chromed = viewFor(input('hub', growth, { chrome }), blank());
      const { treeTop } = treeAt(growth);
      expect(chromed.distance).toBeGreaterThanOrEqual(bare.distance);
      expect(treeShare(chromed, treeTop)).toBeLessThanOrEqual(1 - chrome + 0.005);
    }
  });

  it('fits a narrow stage by its width and a wide one by its height', () => {
    const narrow = viewFor(input('hero', 0.66, { aspect: 0.5 }), blank());
    const wide = viewFor(input('hero', 0.66, { aspect: 2.4 }), blank());
    expect(narrow.distance).toBeGreaterThan(wide.distance);
    const tan = Math.tan((FOV * Math.PI) / 360);
    expect(wide.span).toBeCloseTo(2 * wide.distance * tan, 9);
  });

  it('shows the whole island and the whole tree on a stage without a sky', () => {
    const tan = Math.tan((FOV * Math.PI) / 360);
    for (const aspect of [0.8, 1, 1.5]) {
      for (const growth of [0, 0.03, 0.14, 0.36, 0.66, 1]) {
        const view = viewFor(input('companion', growth, { aspect, whole: true }), blank());
        const { treeTop } = treeAt(growth);
        // The lawn (radius 3) fits the width with air to spare, the rock underside the height.
        expect(3.1 / (view.distance * tan * aspect), `${aspect} at ${growth}`).toBeLessThan(0.95);
        expect(treeShare(view, treeTop), `${aspect} at ${growth}`).toBeLessThan(0.98);
        expect(treeShare(view, -2), `${aspect} at ${growth}`).toBeGreaterThan(0.02);
      }
    }
  });

  it('eases the frame with growth', () => {
    expect(frameShare(0)).toBe(0);
    expect(frameShare(1)).toBe(1);
    expect(frameShare(0.5)).toBeGreaterThan(0.5);
  });
});
