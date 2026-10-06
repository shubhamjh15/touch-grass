import type { EstimateSource } from '../estimate';

/** Illustrative only: real sources come from the evidence table through the game engine. */
export const SAMPLE_SOURCE: EstimateSource = {
  code: 'MOVE-02',
  kind: 'factor',
  formula: '5 km × 0.171 kg/km = 0.86 kg',
  comparedWith: 'Compared with driving the same trip alone in an average petrol car.',
  range: '0.6–1.1 kg',
  sourceLabel: 'Sample dataset',
  year: 2024,
  href: '#data',
};
