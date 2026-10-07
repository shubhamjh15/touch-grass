/**
 * The few values a page needs to point at the methodology and the lessons without loading them.
 * The landing page links to action anchors and quotes two counts; importing those from the
 * content barrel shipped every lesson and dataset to a first-time visitor.
 */
import { EVIDENCE_META } from './catalogue/factors';

export const FACTORS_VERSION = EVIDENCE_META.factorsVersion;

export const actionAnchor = (actionId: string) => `action-${actionId}`;

/** How many lessons the Learn page has. `pointers.test.ts` holds it to the real list. */
export const LESSON_COUNT = 10;
