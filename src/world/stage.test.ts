import { describe, expect, it } from 'vitest';
import {
  CALLOUT,
  landmarkVisible,
  layoutCallouts,
  stageFitsCallouts,
  type ChipSize,
} from './callouts';
import { CAMERA, GOVERNOR, ORBIT, QUALITY } from './config';
import { LANDMARKS } from './contract';
import { OrbitController } from './interaction';
import { QualityGovernor, frameInterval, resolveAutoTier } from './quality';

const COUNT = LANDMARKS.length;
const SIZES: ChipSize[] = LANDMARKS.map((_, index) => ({ width: 90 + index * 9, height: 40 }));

function place(points: Array<[number, number]>, stage = { width: 960, height: 640 }) {
  const anchors = new Float32Array(COUNT * 2);
  const visible = new Uint8Array(COUNT);
  points.forEach(([x, y], index) => {
    anchors[index * 2] = x;
    anchors[index * 2 + 1] = y;
    visible[index] = 1;
  });
  const out = new Float32Array(COUNT * 3);
  layoutCallouts(anchors, visible, SIZES, stage, out, new Uint8Array(COUNT));
  return points.map(([x, y], index) => ({
    anchor: [x, y] as const,
    x: out[index * 3] as number,
    y: out[index * 3 + 1] as number,
    side: out[index * 3 + 2] as number,
    size: SIZES[index] as ChipSize,
  }));
}

describe('landmark visibility', () => {
  it('shows landmarks on the near side and hides them on the far side', () => {
    expect(landmarkVisible(false, 0.8)).toBe(true);
    expect(landmarkVisible(false, 0)).toBe(true);
    expect(landmarkVisible(true, -0.6)).toBe(false);
    expect(landmarkVisible(false, -1)).toBe(false);
  });

  it('has hysteresis, so a landmark on the turning edge does not flicker', () => {
    const edge = (CALLOUT.hideBehind + CALLOUT.showBehind) / 2;
    expect(landmarkVisible(true, edge)).toBe(true);
    expect(landmarkVisible(false, edge)).toBe(false);
  });

  it('never shows an absent object', () => {
    expect(landmarkVisible(true, -9)).toBe(false);
    expect(landmarkVisible(false, -9)).toBe(false);
  });

  it('gives up on stages that are too small for chips', () => {
    expect(stageFitsCallouts(960, 640)).toBe(true);
    expect(stageFitsCallouts(390, 560)).toBe(true);
    expect(stageFitsCallouts(220, 220)).toBe(false);
    expect(stageFitsCallouts(600, 200)).toBe(false);
  });
});

describe('callout layout', () => {
  const anchors: Array<[number, number]> = [
    [520, 430],
    [330, 410],
    [400, 440],
    [480, 520],
    [640, 425],
    [600, 415],
    [470, 380],
  ];

  it('sends each anchor to the nearer column, at the stage edges', () => {
    for (const chip of place(anchors)) {
      const left = chip.anchor[0] < 480;
      expect(chip.side).toBe(left ? -1 : 1);
      if (left) expect(chip.x).toBe(CALLOUT.insetWide);
      else expect(chip.x + chip.size.width).toBe(960 - CALLOUT.insetWide);
    }
  });

  it('keeps the order of the anchors in each column and at least the gap between chips', () => {
    const chips = place(anchors);
    for (const side of [-1, 1]) {
      const column = chips.filter((chip) => chip.side === side);
      column.sort((a, b) => a.anchor[1] - b.anchor[1]);
      for (let i = 1; i < column.length; i += 1) {
        const above = column[i - 1] as (typeof column)[number];
        const below = column[i] as (typeof column)[number];
        expect(below.y - (above.y + above.size.height)).toBeGreaterThanOrEqual(CALLOUT.gap - 1e-3);
      }
    }
  });

  it('never lets two leaders of a column cross', () => {
    const chips = place(anchors);
    const cross = (a: (typeof chips)[number], b: (typeof chips)[number]) => {
      const start = (chip: (typeof chips)[number]): [number, number] => [
        chip.side < 0 ? chip.x + chip.size.width : chip.x,
        chip.y + chip.size.height / 2,
      ];
      const [p1, p2, p3, p4] = [start(a), a.anchor, start(b), b.anchor];
      const turn = (o: readonly number[], q: readonly number[], r: readonly number[]) =>
        Math.sign(
          ((q[0] as number) - (o[0] as number)) * ((r[1] as number) - (o[1] as number)) -
            ((q[1] as number) - (o[1] as number)) * ((r[0] as number) - (o[0] as number)),
        );
      return turn(p1, p2, p3) !== turn(p1, p2, p4) && turn(p3, p4, p1) !== turn(p3, p4, p2);
    };
    // Chips of one column share their inner edge only when they are equally wide: use that case.
    const same = place(anchors).map((chip) => ({ ...chip, size: { width: 100, height: 40 } }));
    for (let i = 0; i < same.length; i += 1) {
      for (let j = i + 1; j < same.length; j += 1) {
        const a = same[i] as (typeof chips)[number];
        const b = same[j] as (typeof chips)[number];
        if (a.side === b.side) expect(cross(a, b), `${i}/${j}`).toBe(false);
      }
    }
    expect(chips).toHaveLength(COUNT);
  });

  it('stays inside a short stage by pushing the column back up', () => {
    const crowded: Array<[number, number]> = LANDMARKS.map((_, index) => [100, 300 + index * 4]);
    const chips = place(crowded, { width: 420, height: 360 });
    for (const chip of chips) {
      expect(chip.y).toBeGreaterThanOrEqual(CALLOUT.inset - 1e-3);
    }
    const lowest = Math.max(...chips.map((chip) => chip.y + chip.size.height));
    expect(lowest).toBeLessThanOrEqual(360 - CALLOUT.inset + 1e-3);
  });

  it('skips hidden landmarks', () => {
    const anchorsArray = new Float32Array(COUNT * 2).fill(200);
    const visible = new Uint8Array(COUNT);
    visible[2] = 1;
    const out = new Float32Array(COUNT * 3).fill(-1);
    layoutCallouts(
      anchorsArray,
      visible,
      SIZES,
      { width: 960, height: 640 },
      out,
      new Uint8Array(COUNT),
    );
    expect(out[2 * 3 + 2]).toBe(-1);
    expect(out[2 * 3]).toBe(CALLOUT.insetWide);
    expect(out[0]).toBe(-1);
    expect(out[3 * 3]).toBe(-1);
  });
});

describe('quality resolver', () => {
  it('starts a software rasteriser on low whatever else it claims', () => {
    expect(resolveAutoTier({ software: true, cores: 16, memoryGb: 32, coarsePointer: false })).toBe(
      'low',
    );
  });

  it('reads device hints: weak machines low, phones medium, desktops high', () => {
    expect(resolveAutoTier({ software: false, cores: 2, memoryGb: 8, coarsePointer: false })).toBe(
      'low',
    );
    expect(resolveAutoTier({ software: false, cores: 8, memoryGb: 2, coarsePointer: true })).toBe(
      'low',
    );
    expect(resolveAutoTier({ software: false, cores: 8, memoryGb: 8, coarsePointer: true })).toBe(
      'medium',
    );
    expect(resolveAutoTier({ software: false, cores: 4, memoryGb: 8, coarsePointer: false })).toBe(
      'medium',
    );
    expect(
      resolveAutoTier({ software: false, cores: 12, memoryGb: 16, coarsePointer: false }),
    ).toBe('high');
    // A browser that tells nothing is treated as an average machine.
    expect(resolveAutoTier({ software: false, coarsePointer: false })).toBe('medium');
  });
});

describe('QualityGovernor', () => {
  const feed = (governor: QualityGovernor, frameMs: number, frames: number) => {
    let changes = 0;
    for (let i = 0; i < frames; i += 1) if (governor.sample(frameMs)) changes += 1;
    return changes;
  };

  it('leaves a fast device alone', () => {
    const governor = new QualityGovernor('high');
    expect(feed(governor, 16.7, 5000)).toBe(0);
    expect(governor.tier).toBe('high');
    expect(governor.dprScale).toBe(1);
  });

  it('steps the resolution down first, then the tier, and never back up', () => {
    const governor = new QualityGovernor('high');
    const seen: string[] = [];
    let cap = governor.dprCap;
    for (let i = 0; i < 40_000 && !governor.exhausted; i += 1) {
      if (!governor.sample(40)) continue;
      seen.push(`${governor.tier}@${governor.dprScale}`);
      // The effective resolution cap only ever goes down.
      expect(governor.dprCap).toBeLessThanOrEqual(cap + 1e-6);
      cap = governor.dprCap;
    }
    expect(seen.slice(0, GOVERNOR.dprSteps.length - 1)).toEqual(
      GOVERNOR.dprSteps.slice(1).map((share) => `high@${share}`),
    );
    expect(seen.some((state) => state.startsWith('medium'))).toBe(true);
    expect(governor.tier).toBe('low');
    expect(governor.exhausted).toBe(true);
    // Fast frames afterwards change nothing: it is a ratchet.
    expect(feed(governor, 8, 5000)).toBe(0);
    expect(governor.tier).toBe('low');
    expect(governor.dprCap).toBeCloseTo(QUALITY.low.dpr * (GOVERNOR.dprSteps.at(-1) ?? 1));
  });

  it('does not oscillate when frames hover around the threshold', () => {
    const governor = new QualityGovernor('medium');
    let changes = 0;
    for (let i = 0; i < 20_000; i += 1) {
      // Slow until the first step down, then comfortably fast: it must settle there.
      if (governor.sample(changes === 0 ? 30 : 20)) changes += 1;
    }
    expect(changes).toBe(1);
    expect(governor.tier).toBe('medium');
  });

  it('ignores hiccups and the frames right after a change', () => {
    const governor = new QualityGovernor('high');
    expect(feed(governor, 900, 2000)).toBe(0);
    expect(feed(governor, 40, GOVERNOR.settle + GOVERNOR.window - 1)).toBe(0);
    expect(feed(governor, 40, 1)).toBe(1);
  });

  it('starts over when the preference changes', () => {
    const governor = new QualityGovernor('high');
    feed(governor, 40, 2000);
    governor.reset('medium');
    expect(governor.tier).toBe('medium');
    expect(governor.dprScale).toBe(1);
  });

  it('caps idle frames by tier', () => {
    expect(frameInterval('high', 100)).toBe(0);
    expect(frameInterval('medium', 2)).toBe(0);
    expect(frameInterval('medium', 9)).toBeCloseTo(1 / 30);
    expect(frameInterval('low', 0)).toBeCloseTo(1 / 30);
  });
});

describe('OrbitController', () => {
  const run = (
    orbit: OrbitController,
    seconds: number,
    mode: Parameters<OrbitController['step']>[1],
    reduced = false,
  ) => {
    for (let t = 0; t < seconds; t += 1 / 60) orbit.step(1 / 60, mode, reduced, true);
  };

  it('turns a hero once every ninety seconds and keeps a ceremony facing front', () => {
    const hero = new OrbitController();
    run(hero, 9, 'hero');
    expect(hero.yaw).toBeCloseTo((Math.PI * 2 * 9) / CAMERA.idle.hero.turn, 1);
    const ceremony = new OrbitController();
    run(ceremony, 9, 'ceremony');
    expect(ceremony.yaw).toBeCloseTo(0, 5);
  });

  it('keeps a hub and a companion almost still', () => {
    for (const mode of ['hub', 'companion'] as const) {
      const orbit = new OrbitController();
      let peak = 0;
      for (let t = 0; t < 40; t += 1 / 60) {
        orbit.step(1 / 60, mode, false, mode === 'hub');
        peak = Math.max(peak, Math.abs(orbit.yaw));
      }
      expect(peak).toBeLessThanOrEqual(CAMERA.idle[mode].drift + 1e-3);
      expect(peak).toBeGreaterThan(0.02);
    }
  });

  it('turns 216 degrees per stage width while dragging and coasts after release', () => {
    const orbit = new OrbitController();
    orbit.step(1 / 60, 'hub', false, true);
    const before = orbit.yaw;
    orbit.dragStart();
    for (let i = 0; i < 30; i += 1) {
      orbit.dragMove(0.5 / 30, 0);
      orbit.step(1 / 60, 'hub', false, true);
    }
    expect(orbit.yaw - before).toBeCloseTo(ORBIT.perStageWidth / 2, 1);
    expect(orbit.moving).toBe(true);
    orbit.dragEnd();
    const released = orbit.yaw;
    run(orbit, 1, 'hub');
    // Inertia carried it further, but the speed was capped.
    expect(orbit.yaw).toBeGreaterThan(released + 0.1);
    expect(orbit.yaw - released).toBeLessThan(ORBIT.maxSpeed * ORBIT.inertia + 0.2);
  });

  it('eases a hub back to its front a few seconds after release, a hero stays turned', () => {
    const hub = new OrbitController();
    hub.dragStart();
    hub.dragMove(0.3, 0);
    hub.step(1 / 60, 'hub', false, true);
    hub.dragEnd();
    run(hub, ORBIT.resumeAfter - 0.5, 'hub');
    expect(Math.abs(hub.yaw)).toBeGreaterThan(0.5);
    run(hub, 3, 'hub');
    expect(Math.abs(hub.yaw)).toBeLessThan(CAMERA.idle.hub.drift + 0.02);

    const hero = new OrbitController();
    hero.dragStart();
    hero.dragMove(0.3, 0);
    hero.step(1 / 60, 'hero', false, true);
    hero.dragEnd();
    run(hero, ORBIT.resumeAfter + 3, 'hero');
    expect(hero.yaw).toBeGreaterThan(ORBIT.perStageWidth * 0.3);
  });

  it('clamps the tilt and lets it spring back', () => {
    const orbit = new OrbitController();
    orbit.dragStart();
    for (let i = 0; i < 200; i += 1) orbit.dragMove(0, 0.05);
    orbit.step(1 / 60, 'hub', false, true);
    expect(orbit.pitch).toBeLessThanOrEqual(ORBIT.maxTilt * 1.3 + 1e-6);
    orbit.dragEnd();
    run(orbit, 2, 'hub');
    expect(orbit.pitch).toBeCloseTo(0, 3);
  });

  it('answers arrow keys in 30 degree steps and Home with the front', () => {
    const orbit = new OrbitController();
    orbit.nudge(1);
    run(orbit, 1, 'hero', true);
    expect(orbit.yaw).toBeCloseTo(ORBIT.keyStep, 3);
    orbit.nudge(-2);
    run(orbit, 1, 'hero', true);
    expect(orbit.yaw).toBeCloseTo(-ORBIT.keyStep, 3);
    orbit.reset();
    run(orbit, 1, 'hero', true);
    expect(orbit.yaw).toBeCloseTo(0, 3);
  });

  it('adds a small parallax on hover and none under reduced motion', () => {
    const orbit = new OrbitController();
    orbit.hover(1, -1);
    run(orbit, 2, 'ceremony');
    expect(orbit.yaw).toBeCloseTo(ORBIT.hoverYaw, 2);
    expect(orbit.pitch).toBeCloseTo(-ORBIT.hoverPitch, 2);
    const calm = new OrbitController();
    calm.hover(1, 1);
    run(calm, 2, 'hub', true);
    expect(calm.yaw).toBe(0);
    expect(calm.pitch).toBe(0);
  });

  it('holds still under reduced motion but still follows a drag', () => {
    const orbit = new OrbitController();
    run(orbit, 20, 'hero', true);
    expect(orbit.yaw).toBe(0);
    orbit.dragStart();
    orbit.dragMove(0.25, 0);
    orbit.step(1 / 60, 'hero', true, true);
    expect(orbit.yaw).toBeCloseTo(ORBIT.perStageWidth / 4, 3);
  });

  it('unwinds to the front when a turning hero becomes a hub', () => {
    const orbit = new OrbitController();
    run(orbit, 30, 'hero');
    expect(orbit.yaw).toBeGreaterThan(1.5);
    run(orbit, 4, 'hub');
    const turns = orbit.yaw / (Math.PI * 2);
    expect(Math.abs(turns - Math.round(turns)) * Math.PI * 2).toBeLessThan(
      CAMERA.idle.hub.drift + 0.02,
    );
  });
});
