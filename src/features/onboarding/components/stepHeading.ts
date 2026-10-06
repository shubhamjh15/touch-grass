import { createContext, type RefObject } from 'react';

/**
 * Where the page keeps a handle on the current step's heading: when the step changes, focus
 * lands there, so a screen reader announces the new question and Tab starts at the top.
 */
export const StepHeadingContext = createContext<RefObject<HTMLHeadingElement | null> | null>(null);
