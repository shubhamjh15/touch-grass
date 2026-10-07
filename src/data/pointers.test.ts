import { describe, expect, it } from 'vitest';
import { EVIDENCE_META } from './catalogue';
import { LESSONS } from './lessons';
import {
  FACTORS_VERSION as METHODOLOGY_VERSION,
  actionAnchor as methodologyAnchor,
} from './methodology';
import { FACTORS_VERSION, LESSON_COUNT, actionAnchor } from './pointers';

describe('pointers', () => {
  it('counts the lessons that exist', () => {
    expect(LESSON_COUNT).toBe(LESSONS.length);
  });

  it('is what the methodology page uses', () => {
    expect(FACTORS_VERSION).toBe(EVIDENCE_META.factorsVersion);
    expect(METHODOLOGY_VERSION).toBe(FACTORS_VERSION);
    expect(methodologyAnchor).toBe(actionAnchor);
  });
});
