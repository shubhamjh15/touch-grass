import { describe, expect, it } from 'vitest';
import { ISLAND_PROPS, LANDMARKS } from '../contract';
import { layoutIsland } from '../props/layout';
import { Kit, triangleCount } from './kit';
import {
  disposeModel,
  flowerBed,
  landmarkModel,
  propModel,
  type GroundModelId,
  type PropModel,
} from './propModels';

const CREATURES = ['birds', 'butterflies', 'fireflies'];
const GROUND = ISLAND_PROPS.filter(
  (id): id is GroundModelId => id !== 'flowers' && !CREATURES.includes(id),
);

const triangles = (model: PropModel) =>
  triangleCount(model.body) +
  (model.moving ? triangleCount(model.moving.geometry) : 0) +
  (model.glow ? triangleCount(model.glow) : 0);

describe('the modelling kit', () => {
  it('merges painted parts into one geometry with a colour and a sway per vertex', () => {
    const geometry = new Kit()
      .box(1, 1, 1, '#ff0000', { at: [0, 0.5, 0] })
      .ball(0.5, '#00ff00', { at: [0, 1.5, 0], sway: [1, 2] })
      .cyl(0.1, 0.1, 1, '#0000ff', { tip: 1 })
      .build(false);
    const points = geometry.getAttribute('position');
    expect(geometry.getAttribute('color').count).toBe(points.count);
    expect(geometry.getAttribute('aTip').count).toBe(points.count);
    expect(geometry.getIndex()).toBeNull();
    const tips = Array.from(geometry.getAttribute('aTip').array);
    expect(Math.min(...tips)).toBe(0);
    expect(Math.max(...tips)).toBe(1);
    expect(triangleCount(geometry)).toBeGreaterThan(12);
  });
});

describe('prop and landmark models', () => {
  it('has a model for every ground prop of the contract, standing on the lawn', () => {
    expect(GROUND).toHaveLength(ISLAND_PROPS.length - 4);
    for (const id of GROUND) {
      const model = propModel(id);
      const box = model.body.boundingBox;
      expect(box, id).not.toBeNull();
      expect(box?.min.y ?? -1, id).toBeGreaterThanOrEqual(-0.02);
      expect(model.height, id).toBeGreaterThan(0.2);
      // Footprints of the layout are at most half a unit: nothing sprawls beyond its own.
      expect(Math.max(box?.max.x ?? 9, -(box?.min.x ?? -9)), id).toBeLessThan(0.62);
      disposeModel(model);
    }
  });

  it('has a model for every landmark, and one ring per milestone on the medallion', () => {
    for (const id of LANDMARKS) {
      const model = landmarkModel(id, 3);
      expect(triangleCount(model.body), id).toBeGreaterThan(20);
      disposeModel(model);
    }
    const young = landmarkModel('impact', 1);
    const old = landmarkModel('impact', 5);
    expect(triangleCount(old.body)).toBeGreaterThan(triangleCount(young.body));
  });

  it('gives the turbine, the swing and the pond a part that moves, and the lantern a glow', () => {
    expect(propModel('turbine').moving?.motion).toBe('spin');
    expect(propModel('swing').moving?.motion).toBe('swing');
    expect(propModel('pond').moving?.motion).toBe('float');
    expect(propModel('lantern').glow).toBeDefined();
  });

  it('stays inside the triangle budget: no toy over 900, all of them under 11 000', () => {
    let total = triangleCount(flowerBed(layoutIsland(7).flowers));
    expect(total).toBeLessThan(2200);
    for (const id of GROUND) {
      const count = triangles(propModel(id));
      expect(count, id).toBeLessThanOrEqual(900);
      total += count;
    }
    for (const id of LANDMARKS) {
      const count = triangles(landmarkModel(id, 5));
      expect(count, id).toBeLessThanOrEqual(900);
      total += count;
    }
    expect(total).toBeLessThan(11_000);
  });
});
