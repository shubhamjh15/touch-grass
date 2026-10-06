import { describe, expect, it } from 'vitest';
import {
  TOUR_INITIAL,
  TOUR_STEPS,
  isTourOpen,
  parseTourState,
  tourReducer,
  tourStepNumber,
  type TourEvent,
  type TourState,
} from './tour';

const run = (events: readonly TourEvent[], from: TourState = TOUR_INITIAL): TourState =>
  events.reduce(tourReducer, from);

describe('the tour', () => {
  it('has four steps, in the order a visitor meets them', () => {
    expect(TOUR_STEPS).toEqual(['world', 'log', 'impact', 'coach']);
    expect(TOUR_STEPS.map(tourStepNumber)).toEqual([1, 2, 3, 4]);
  });

  it('begins with the world when the demo opens', () => {
    const state = run([{ type: 'start' }]);
    expect(state).toEqual({ status: 'running', step: 'world', did: false });
    expect(isTourOpen(state)).toBe(true);
  });

  it('walks forward with Next, to a last card and then out', () => {
    const steps: TourState[] = [];
    let state = run([{ type: 'start' }]);
    for (let presses = 0; presses < 5; presses += 1) {
      steps.push(state);
      state = tourReducer(state, { type: 'next' });
    }
    expect(steps.map((step) => (step.status === 'running' ? step.step : step.status))).toEqual([
      'world',
      'log',
      'impact',
      'coach',
      'wrap',
    ]);
    expect(state).toEqual({ status: 'closed', finished: true });
    expect(isTourOpen(state)).toBe(false);
  });

  it('notices when the visitor does what the step asks, and only then', () => {
    const state = run([{ type: 'start' }, { type: 'did', step: 'log' }]);
    expect(state).toEqual({ status: 'running', step: 'world', did: false });
    const did = tourReducer(state, { type: 'did', step: 'world' });
    expect(did).toEqual({ status: 'running', step: 'world', did: true });
    // Doing it twice is still one step.
    expect(tourReducer(did, { type: 'did', step: 'world' })).toBe(did);
    expect(tourReducer(did, { type: 'next' })).toEqual({
      status: 'running',
      step: 'log',
      did: false,
    });
  });

  it('goes back one step, and never before the first', () => {
    const second = run([{ type: 'start' }, { type: 'next' }]);
    expect(tourReducer(second, { type: 'back' })).toEqual({
      status: 'running',
      step: 'world',
      did: false,
    });
    const firstStep = run([{ type: 'start' }]);
    expect(tourReducer(firstStep, { type: 'back' })).toBe(firstStep);
    const wrap = run([
      { type: 'start' },
      { type: 'next' },
      { type: 'next' },
      { type: 'next' },
      { type: 'next' },
    ]);
    expect(wrap).toEqual({ status: 'wrap' });
    expect(tourReducer(wrap, { type: 'back' })).toMatchObject({ status: 'running', step: 'coach' });
  });

  it('can be skipped at any step, and stays closed when the demo opens again', () => {
    for (let presses = 0; presses < TOUR_STEPS.length; presses += 1) {
      const moves: TourEvent[] = Array.from({ length: presses }, () => ({ type: 'next' }));
      const closed = run([{ type: 'start' }, ...moves, { type: 'dismiss' }]);
      expect(closed).toEqual({ status: 'closed', finished: false });
      expect(run([{ type: 'leave' }, { type: 'start' }], closed)).toBe(closed);
    }
  });

  it('starts again from the first step when asked to', () => {
    const closed = run([{ type: 'start' }, { type: 'next' }, { type: 'dismiss' }]);
    expect(tourReducer(closed, { type: 'restart' })).toEqual({
      status: 'running',
      step: 'world',
      did: false,
    });
    const midway = run([{ type: 'start' }, { type: 'next' }, { type: 'next' }]);
    expect(tourReducer(midway, { type: 'restart' })).toMatchObject({ step: 'world' });
  });

  it('forgets an unfinished tour when the demo ends, so the next visit starts it again', () => {
    const midway = run([{ type: 'start' }, { type: 'next' }]);
    const left = tourReducer(midway, { type: 'leave' });
    expect(left).toEqual(TOUR_INITIAL);
    expect(tourReducer(left, { type: 'start' })).toMatchObject({
      status: 'running',
      step: 'world',
    });
  });

  it('counts leaving from the last card as finishing', () => {
    const wrap = run([
      { type: 'start' },
      { type: 'next' },
      { type: 'next' },
      { type: 'next' },
      { type: 'next' },
    ]);
    const left = tourReducer(wrap, { type: 'leave' });
    expect(left).toEqual({ status: 'closed', finished: true });
    expect(tourReducer(left, { type: 'start' })).toBe(left);
  });

  it('ignores moves that make no sense where it stands', () => {
    expect(run([{ type: 'next' }])).toBe(TOUR_INITIAL);
    expect(run([{ type: 'back' }])).toBe(TOUR_INITIAL);
    expect(run([{ type: 'dismiss' }])).toBe(TOUR_INITIAL);
    expect(run([{ type: 'did', step: 'world' }])).toBe(TOUR_INITIAL);
    const closed: TourState = { status: 'closed', finished: true };
    expect(run([{ type: 'next' }, { type: 'dismiss' }, { type: 'start' }], closed)).toBe(closed);
  });

  it('survives a reload through session storage, and distrusts anything odd in it', () => {
    const states: TourState[] = [
      { status: 'running', step: 'impact', did: true },
      { status: 'wrap' },
      { status: 'closed', finished: false },
      { status: 'closed', finished: true },
    ];
    for (const state of states) expect(parseTourState(JSON.stringify(state))).toEqual(state);
    for (const raw of [null, '', 'not json', '42', '{"status":"running","step":"moon"}', '[]']) {
      expect(parseTourState(raw)).toEqual(TOUR_INITIAL);
    }
  });
});
