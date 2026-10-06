import { describe, expect, it } from 'vitest';
import { ORBIT } from './config';
import { ISLAND_PROPS, LANDMARKS } from './contract';
import { OrbitController } from './interaction';
import {
  LIFE_CAPS,
  beeAt,
  birdAt,
  butterflyAt,
  createFlyer,
  daylight,
  flinch,
  lifeCounts,
  presenceAt,
  type LifeCounts,
  type LifeProps,
} from './life';
import { LANDMARK_INFO, PROP_INFO, describeIsland, describePart } from './props/info';

const none: LifeProps = {
  flowers: false,
  butterflies: false,
  birds: false,
  birdhouse: false,
  beehive: false,
  fireflies: false,
};
const all: LifeProps = {
  flowers: true,
  butterflies: true,
  birds: true,
  birdhouse: true,
  beehive: true,
  fireflies: true,
};
const counts = (): LifeCounts => ({ butterflies: 0, birds: 0, bees: 0, fireflies: 0, leaves: 0 });

describe('who is out at which hour', () => {
  it('has day at noon, night at midnight and a soft dawn and dusk between', () => {
    expect(daylight(12)).toBe(1);
    expect(daylight(0)).toBe(0);
    expect(daylight(6)).toBeGreaterThan(0);
    expect(daylight(6)).toBeLessThan(1);
    expect(daylight(19.5)).toBeCloseTo(0.5);
  });

  it('keeps butterflies and bees to the day and fireflies to the night', () => {
    const noon = presenceAt(12, counts());
    expect(noon).toMatchObject({ butterflies: 1, bees: 1, birds: 1, fireflies: 0 });
    const night = presenceAt(23, counts());
    expect(night).toMatchObject({ butterflies: 0, bees: 0, birds: 0, fireflies: 1 });
    const early = presenceAt(2, counts());
    expect(early.fireflies).toBe(1);
  });
});

describe('how many live on the island', () => {
  it('gives a bare island a visitor or two and earned props the rest', () => {
    const bare = lifeCounts('medium', none, 1, counts());
    expect(bare).toMatchObject({ butterflies: 1, birds: 1, bees: 0 });
    expect(bare.fireflies).toBeGreaterThan(0);
    const full = lifeCounts('medium', all, 1, counts());
    expect(full.butterflies).toBeGreaterThan(bare.butterflies);
    expect(full.birds).toBeGreaterThan(bare.birds);
    expect(full.bees).toBeGreaterThanOrEqual(3);
    expect(full.fireflies).toBeGreaterThan(bare.fireflies);
  });

  it('never exceeds the cap of the tier, and lower tiers never draw more', () => {
    const tiers = ['low', 'medium', 'high'] as const;
    let previous = counts();
    for (const tier of tiers) {
      const now = lifeCounts(tier, all, 1, counts());
      for (const key of Object.keys(now) as Array<keyof LifeCounts>) {
        expect(now[key], `${tier} ${key}`).toBeLessThanOrEqual(LIFE_CAPS[tier][key]);
        expect(now[key], `${tier} ${key}`).toBeGreaterThanOrEqual(previous[key]);
      }
      previous = now;
    }
  });

  it('is quiet around a dormant tree and sheds more around a thirsty one', () => {
    const dormant = lifeCounts('high', all, 0, counts());
    expect(dormant.leaves).toBe(0);
    expect(dormant.butterflies).toBeLessThan(lifeCounts('high', all, 1, counts()).butterflies);
    const thirsty = lifeCounts('high', all, 0.5, counts());
    expect(thirsty.leaves).toBeGreaterThan(lifeCounts('high', all, 1, counts()).leaves);
  });
});

describe('where a flyer is', () => {
  const home = { x: 1, y: 0.1, z: 2 };
  const tree = { x: 0, y: 0, z: -0.7, top: 3, halfWidth: 1.4 };

  it('keeps butterflies and bees near home and above the grass, for ever', () => {
    const out = createFlyer();
    // One pass over ten minutes of flight; judged once, so the test stays quick.
    let butterflyReach = 0;
    let butterflyLow = Number.POSITIVE_INFINITY;
    let beeReach = 0;
    for (let t = 0; t < 600; t += 0.37) {
      for (let i = 0; i < 7; i += 1) {
        butterflyAt(i, t, home, out);
        butterflyReach = Math.max(butterflyReach, Math.hypot(out.x - home.x, out.z - home.z));
        butterflyLow = Math.min(butterflyLow, out.y);
        beeAt(i, t, home, out);
        beeReach = Math.max(beeReach, Math.hypot(out.x - home.x, out.z - home.z));
      }
    }
    expect(butterflyReach).toBeLessThan(0.75);
    expect(butterflyLow).toBeGreaterThan(home.y + 0.3);
    expect(beeReach).toBeLessThan(0.6);
  });

  it('flies birds round the crown, clear of it and above the lawn', () => {
    const out = createFlyer();
    let nearest = Number.POSITIVE_INFINITY;
    let lowest = Number.POSITIVE_INFINITY;
    let finite = true;
    for (let t = 0; t < 300; t += 0.41) {
      for (let i = 0; i < 4; i += 1) {
        birdAt(i, t, tree, out);
        nearest = Math.min(nearest, Math.hypot(out.x - tree.x, (out.z - tree.z) / 0.82));
        lowest = Math.min(lowest, out.y);
        finite = finite && Number.isFinite(out.heading) && Number.isFinite(out.bank);
      }
    }
    expect(nearest).toBeGreaterThan(tree.halfWidth);
    expect(lowest).toBeGreaterThan(1.2);
    expect(finite).toBe(true);
  });

  it('is a pure function of the clock', () => {
    const a = butterflyAt(2, 12.5, home, createFlyer());
    const b = butterflyAt(2, 12.5, home, createFlyer());
    expect(a).toEqual(b);
  });

  it('flinches away from a tap nearby and ignores one far off', () => {
    const near = flinch({ x: 0.3, y: 1, z: 0, heading: 0, bank: 0 }, { x: 0, y: 0, z: 0 }, 1);
    expect(near.x).toBeGreaterThan(0.3);
    expect(near.y).toBeGreaterThan(1);
    const far = flinch({ x: 5, y: 1, z: 0, heading: 0, bank: 0 }, { x: 0, y: 0, z: 0 }, 1);
    expect(far).toMatchObject({ x: 5, y: 1 });
    const calm = flinch({ x: 0.3, y: 1, z: 0, heading: 0, bank: 0 }, { x: 0, y: 0, z: 0 }, 0);
    expect(calm).toMatchObject({ x: 0.3, y: 1 });
  });
});

describe('what things are called', () => {
  it('names every prop and every landmark, and says what earned it', () => {
    for (const id of ISLAND_PROPS) {
      expect(PROP_INFO[id].name.length, id).toBeGreaterThan(2);
      expect(PROP_INFO[id].note, id).toMatch(/\.$/);
    }
    for (const id of LANDMARKS) {
      expect(LANDMARK_INFO[id].action.length, id).toBeGreaterThan(2);
    }
  });

  it('never shows the working title', () => {
    const text = JSON.stringify([PROP_INFO, LANDMARK_INFO]).toLowerCase();
    expect(text).not.toContain('ecoquest');
  });

  it('reads hit-test part names', () => {
    expect(describePart('prop:bench')).toMatchObject({ kind: 'prop', id: 'bench' });
    expect(describePart('landmark:coach')).toMatchObject({ kind: 'landmark', id: 'coach' });
    expect(describePart('tree')).toBeNull();
    expect(describePart('prop:teapot')).toBeNull();
  });

  it('describes the island in one sentence', () => {
    expect(describeIsland([])).toMatch(/bare/);
    expect(describeIsland(['bench'])).toBe('On the island: bench.');
    expect(describeIsland(['signpost', 'bench', 'flowers'])).toBe(
      'On the island: flowers, bench and signpost.',
    );
  });
});

describe('the camera in Explore mode', () => {
  const settle = (orbit: OrbitController, free: boolean, seconds = 3) => {
    for (let t = 0; t < seconds; t += 1 / 60) orbit.step(1 / 60, 'hub', false, true, free);
  };

  it('opens a little closer, zooms within its limits and returns home outside it', () => {
    const orbit = new OrbitController();
    settle(orbit, false);
    expect(orbit.zoom).toBe(1);
    settle(orbit, true);
    expect(orbit.zoom).toBeCloseTo(ORBIT.exploreZoom);
    for (let i = 0; i < 40; i += 1) orbit.zoomBy(0.8);
    settle(orbit, true);
    expect(orbit.zoom).toBeCloseTo(ORBIT.zoom[0]);
    for (let i = 0; i < 40; i += 1) orbit.zoomBy(1.25);
    settle(orbit, true);
    expect(orbit.zoom).toBeCloseTo(ORBIT.zoom[1]);
    settle(orbit, false);
    expect(orbit.zoom).toBe(1);
  });

  it('keeps the view where the user left it, and only there', () => {
    const free = new OrbitController();
    settle(free, true, 0.5);
    free.dragStart();
    free.dragMove(0.2, 0.1);
    free.dragEnd();
    settle(free, true, 8);
    expect(Math.abs(free.yaw)).toBeGreaterThan(0.3);
    expect(free.pitch).toBeGreaterThan(ORBIT.exploreTilt);

    const hub = new OrbitController();
    hub.dragStart();
    hub.dragMove(0.2, 0.1);
    hub.dragEnd();
    settle(hub, false, 8);
    expect(Math.abs(hub.yaw)).toBeLessThan(0.1);
    expect(Math.abs(hub.pitch)).toBeLessThan(0.01);
  });

  it('comes to rest, so the governor can judge a still world', () => {
    const orbit = new OrbitController();
    settle(orbit, true, 0.2);
    orbit.zoomBy(0.7);
    settle(orbit, true, 4);
    expect(orbit.moving).toBe(false);
  });
});
