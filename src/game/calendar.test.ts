import { afterEach, describe, expect, it } from 'vitest';
import { addDays, dayKey, weekKey } from '@/lib/dates';
import {
  activeDaysIn,
  effectiveDay,
  isClockSkewed,
  isClockSuspect,
  normalizeRestDays,
  restDaysEffectiveFrom,
  restDaysOn,
  weekStrip,
  weekdayOf,
} from './calendar';
import { updateSettings, water } from './engine';
import { logAction, removeLog } from './logging';
import { checkInvariants, createInitialState } from './state';
import { GameSession, localTime, plantedSession } from './testkit';
import { vitalityValue } from './vitality';

const MON = '2026-10-05';
const day = (offset: number) => addDays(MON, offset);
const noon = (offset: number) => localTime(day(offset), 12);

function closeRing(session: GameSession, now: number): void {
  session.at(now, (ctx) => logAction(ctx, { actionId: 'plant-based-meal', qty: 3 }));
}

describe('planting', () => {
  it('draws ring 1 and pays the ceremony exactly once', () => {
    const session = plantedSession(noon(0));
    const { state } = session;
    expect(state.xp).toBe(35);
    expect(state.tree).toMatchObject({ gp: 8, rings: 1, fullRings: 0, vitality: 'thriving' });
    expect(state.streak).toMatchObject({ current: 1, best: 1 });
    expect(state.marks[MON]).toBe('ring');
    expect(state.profile).toMatchObject({ treeName: 'Fern', plantedDay: MON });
    expect(state.rain).toMatchObject({ bank: 1, lastRefillWeek: 'W2026-10-05' });
    expect(state.quests.daily?.key).toBe(MON);
    expect(state.quests.weekly?.key).toBe('W2026-10-05');
    expect(session.eventsOf('planted')).toHaveLength(1);
    expect(checkInvariants(state)).toEqual([]);
  });
});

describe('check-in', () => {
  it('fires once per day and cannot be repeated', () => {
    const session = plantedSession(noon(0));
    expect(session.at(noon(0) + 1000, water)).toBe(false);
    expect(session.state.xp).toBe(35);
    expect(session.at(noon(1), water)).toBe(true);
    expect(session.state.xp).toBe(45);
    expect(session.state.tree).toMatchObject({ gp: 16, rings: 2 });
    expect(session.state.streak.current).toBe(2);
    expect(session.eventsOf('checked-in')[0]).toMatchObject({ via: 'water', implicit: false });
    expect(session.at(noon(1) + 5000, water)).toBe(false);
    expect(session.state.tree.rings).toBe(2);
  });

  it('happens implicitly with the first log of a day', () => {
    const session = plantedSession(noon(0));
    session.at(noon(1), (ctx) => logAction(ctx, { actionId: 'plant-based-meal', qty: 1 }));
    expect(session.eventsOf('checked-in')[0]).toMatchObject({ via: 'log', implicit: true });
    expect(session.eventsOf('action-logged')[0]?.firstActToday).toBe(true);
    expect(session.state.tree.rings).toBe(2);
  });

  it('pays streak milestones once and gifts rain at 7 days', () => {
    const session = plantedSession(noon(0));
    for (let offset = 1; offset <= 2; offset += 1) session.at(noon(offset), water);
    expect(session.eventsOf('streak-milestone')).toEqual([
      { type: 'streak-milestone', days: 3, xp: 15 },
    ]);
    expect(session.state.xp).toBe(35 + 10 + 10 + 15);
    for (let offset = 3; offset <= 6; offset += 1) session.at(noon(offset), water);
    expect(session.state.streak.milestones).toEqual([3, 7]);
    expect(session.state.rain.gifts).toEqual([7]);
    expect(session.state.rain.bank).toBe(2);
    session.at(noon(7), water);
    expect(session.eventsOf('streak-milestone')).toEqual([]);
    expect(session.state.rain.bank).toBe(2);
  });
});

describe('settling days', () => {
  it('lets rain cover a gap it can cover in full', () => {
    const session = plantedSession(noon(0));
    session.tick(noon(2));
    expect(session.state.marks[day(1)]).toBe('rain');
    expect(session.state.rain.bank).toBe(0);
    expect(session.state.streak.current).toBe(1);
    expect(session.state.tree).toMatchObject({ missed: 0, vitality: 'thriving' });
    expect(session.eventsOf('freeze-used')[0]).toMatchObject({ days: [day(1)], bank: 0 });
    expect(session.state.notices.map((notice) => notice.kind)).toEqual(['rain-return']);
    session.at(noon(2), water);
    expect(session.state.streak.current).toBe(2);
    expect(session.state.days[day(2)]?.returnedFrom).toBe('rain');
  });

  it('never covers part of a gap: the clouds stay in the bank', () => {
    const session = plantedSession(noon(0));
    session.tick(noon(3));
    expect(session.state.marks[day(1)]).toBe('missed');
    expect(session.state.marks[day(2)]).toBe('missed');
    expect(session.state.rain.bank).toBe(1);
    expect(session.state.streak).toMatchObject({ current: 0, best: 1 });
    expect(session.state.tree).toMatchObject({ missed: 2, vitality: 'thirsty' });
    expect(vitalityValue(session.state.tree.vitality, session.state.tree.missed)).toBe(0.62);
    expect(session.state.notices).toEqual([]);
  });

  it('ends a streak of two silently and announces one of three', () => {
    const quiet = plantedSession(noon(0));
    quiet.at(noon(1), water);
    quiet.tick(noon(5));
    expect(quiet.eventsOf('streak-rested')).toEqual([
      { type: 'streak-rested', days: 2, announced: false },
    ]);
    expect(quiet.state.notices).toEqual([]);

    const loud = plantedSession(noon(0));
    loud.at(noon(1), water);
    loud.at(noon(2), water);
    loud.tick(noon(6));
    expect(loud.eventsOf('streak-rested')[0]).toMatchObject({ days: 3, announced: true });
    expect(loud.state.notices[0]).toMatchObject({ kind: 'streak-rested', data: { streak: 3 } });
    expect(loud.state.streak).toMatchObject({ current: 0, best: 3 });
  });

  it('settles a long absence in one go and is idempotent within a day', () => {
    const session = plantedSession(noon(0));
    // Coming back and doing something: the whole absence is closed at once.
    session.settle(noon(400));
    const snapshot = session.state;
    expect(Object.values(snapshot.marks).filter((mark) => mark === 'missed')).toHaveLength(399);
    expect(snapshot.tree.missed).toBe(399);
    session.tick(noon(400) + 60_000);
    expect(session.state).toBe(snapshot);
    expect(checkInvariants(snapshot)).toEqual([]);
  });

  it('refills an empty bank once per week, at the first check-in', () => {
    const session = plantedSession(noon(0));
    session.at(noon(2), water);
    expect(session.state.rain.bank).toBe(0);
    session.at(noon(3), water);
    expect(session.state.rain.bank).toBe(0);
    session.at(noon(7), water);
    expect(session.eventsOf('rain-earned')).toEqual([
      { type: 'rain-earned', reason: 'weekly', bank: 1 },
    ]);
    expect(session.state.rain.lastRefillWeek).toBe(weekKey(day(7)));
    session.at(noon(8), water);
    expect(session.state.rain.bank).toBe(1);
    session.at(noon(14), water);
    expect(session.state.rain.bank).toBe(1);
    expect(session.eventsOf('rain-earned')).toEqual([]);
  });
});

describe('rest days', () => {
  it('are neutral: no effect on streak, rain or the tree', () => {
    const session = new GameSession(createInitialState(noon(0)));
    session.at(noon(0), (ctx) => updateSettings(ctx, { restDays: [weekdayOf(day(1))] }));
    const planted = plantedSession(noon(0));
    planted.state = { ...planted.state, settings: session.state.settings };
    planted.at(noon(2), water);
    expect(planted.state.marks[day(1)]).toBe('rest');
    expect(planted.state.streak.current).toBe(2);
    expect(planted.state.rain.bank).toBe(1);
    expect(planted.state.tree.missed).toBe(0);
    expect(planted.state.days[day(2)]?.returnedFrom).toBeNull();
  });

  it('take effect only from the following Monday', () => {
    const session = plantedSession(noon(0));
    const wednesday = weekdayOf(day(2));
    session.at(noon(0), (ctx) => updateSettings(ctx, { restDays: [wednesday] }));
    expect(session.state.settings).toMatchObject({
      restDays: [],
      restDaysPending: [wednesday],
      restDaysFrom: day(7),
    });
    expect(restDaysOn(session.state.settings, day(2))).toEqual([]);
    expect(restDaysOn(session.state.settings, day(9))).toEqual([wednesday]);
    session.at(noon(1), water);
    session.at(noon(3), water);
    expect(session.state.marks[day(2)]).toBe('rain');
    for (let offset = 4; offset <= 8; offset += 1) session.at(noon(offset), water);
    expect(session.state.settings).toMatchObject({ restDays: [wednesday], restDaysPending: null });
    session.at(noon(10), water);
    expect(session.state.marks[day(9)]).toBe('rest');
  });

  it('keeps at most three valid weekdays', () => {
    expect(normalizeRestDays([6, 0, 0, 9, 3, 1, -1, 2.5])).toEqual([0, 1, 3]);
    expect(restDaysEffectiveFrom('2026-10-06')).toBe('2026-10-12');
    expect(restDaysEffectiveFrom('2026-10-12')).toBe('2026-10-19');
  });
});

describe('vitality', () => {
  it('gets thirsty, then dormant after a week, and never loses a ring', () => {
    const session = plantedSession(noon(0));
    session.tick(noon(4));
    expect(session.state.tree).toMatchObject({ vitality: 'thirsty', missed: 3, rings: 1 });
    session.tick(noon(9));
    expect(session.state.tree).toMatchObject({ vitality: 'dormant', missed: 8, rings: 1, gp: 8 });
    expect(vitalityValue('dormant', 8)).toBe(0);
    expect(session.state.xp).toBe(35);
  });

  it('wakes on check-in and thrives when the ring closes', () => {
    const session = plantedSession(noon(0));
    session.at(noon(9), water);
    expect(session.state.tree).toMatchObject({ vitality: 'waking', missed: 0 });
    expect(session.eventsOf('vitality-restored')).toEqual([
      { type: 'vitality-restored', from: 'dormant', to: 'waking' },
    ]);
    expect(session.state.days[day(9)]?.returnedFrom).toBe('dormant');
    closeRing(session, noon(9) + 1000);
    expect(session.state.tree.vitality).toBe('thriving');
    expect(session.state.badges['comeback-kid']?.tier).toBe(1);
  });

  it('thrives again at the next check-in even without a full ring', () => {
    const session = plantedSession(noon(0));
    session.at(noon(9), water);
    session.at(noon(10), water);
    expect(session.state.tree.vitality).toBe('thriving');
  });

  it('recovers from thirsty the instant you check in', () => {
    const session = plantedSession(noon(0));
    session.at(noon(4), water);
    expect(session.state.tree).toMatchObject({ vitality: 'thriving', missed: 0 });
    expect(session.eventsOf('vitality-restored')[0]).toMatchObject({
      from: 'thirsty',
      to: 'thriving',
    });
    expect(session.state.days[day(4)]?.returnedFrom).toBe('missed');
  });
});

describe('the day ring', () => {
  it('closes on the third rewarded act and re-opens on undo', () => {
    const session = plantedSession(noon(0));
    session.at(noon(0) + 1000, (ctx) => logAction(ctx, { actionId: 'plant-based-meal', qty: 2 }));
    expect(session.state.days[MON]?.ringClosed).toBe(false);
    const before = session.state;
    const result = session.at(noon(0) + 5000, (ctx) =>
      logAction(ctx, { actionId: 'refuse-single-use-bottle', qty: 1 }),
    );
    expect(session.state.marks[MON]).toBe('full');
    expect(session.state.tree.fullRings).toBe(1);
    expect(session.state.rain.progress).toBe(1);
    expect(session.state.days[MON]?.ringRain).toBe('progress');
    expect(session.state.xp).toBe(before.xp + 8 + 10);
    expect(session.state.tree.gp).toBe(before.tree.gp + 3 + 4);
    expect(session.eventsOf('ring')[0]).toMatchObject({ state: 'closed', first: true });

    if (!result.ok) throw new Error('log refused');
    session.at(noon(0) + 6000, (ctx) => removeLog(ctx, result.log.id));
    expect(session.state.marks[MON]).toBe('ring');
    expect(session.state.tree.fullRings).toBe(0);
    expect(session.state.xp).toBe(before.xp);
    expect(session.state.tree.gp).toBe(before.tree.gp);
    expect(session.state.rain.progress).toBe(0);
    expect(session.eventsOf('ring')[0]).toMatchObject({ state: 'reopened' });

    session.at(noon(0) + 9000, (ctx) =>
      logAction(ctx, { actionId: 'refuse-single-use-bottle', qty: 1 }),
    );
    expect(session.eventsOf('ring')[0]).toMatchObject({ state: 'closed', first: false });
    expect(checkInvariants(session.state)).toEqual([]);
  });

  it('earns a cloud for every five full rings while the bank is below its cap', () => {
    const session = plantedSession(noon(0));
    for (let offset = 0; offset <= 3; offset += 1) closeRing(session, noon(offset) + 1000);
    expect(session.state.rain).toMatchObject({ bank: 1, progress: 4 });
    const fifth = session.at(noon(4), (ctx) =>
      logAction(ctx, { actionId: 'plant-based-meal', qty: 3 }),
    );
    expect(session.state.rain).toMatchObject({ bank: 2, progress: 0 });
    expect(session.state.days[day(4)]?.ringRain).toBe('cloud');
    expect(session.eventsOf('rain-earned')).toEqual([
      { type: 'rain-earned', reason: 'rings', bank: 2 },
    ]);

    if (!fifth.ok) throw new Error('log refused');
    session.at(noon(4) + 1000, (ctx) => removeLog(ctx, fifth.log.id));
    expect(session.state.rain).toMatchObject({ bank: 1, progress: 4 });
    closeRing(session, noon(4) + 5000);
    expect(session.state.rain).toMatchObject({ bank: 2, progress: 0 });

    closeRing(session, noon(5));
    expect(session.state.rain).toMatchObject({ bank: 2, progress: 0 });
    expect(session.state.days[day(5)]?.ringRain).toBe('none');
    expect(checkInvariants(session.state)).toEqual([]);
  });
});

describe('clock guards', () => {
  it('attributes an event to the settled day when the clock moves west', () => {
    const session = plantedSession(noon(1));
    const earlier = localTime(day(0), 23, 30);
    expect(effectiveDay(session.state, earlier)).toBe(day(1));
    expect(session.at(earlier, water)).toBe(false);
    const result = session.at(earlier, (ctx) =>
      logAction(ctx, { actionId: 'plant-based-meal', qty: 1 }),
    );
    expect(result.ok && result.log.day).toBe(day(1));
    expect(session.state.clock.today).toBe(day(1));
    expect(session.state.tree.rings).toBe(1);
    expect(checkInvariants(session.state)).toEqual([]);
  });

  it('settles nothing while the newest event lies in the future', () => {
    const session = plantedSession(noon(10));
    const back = noon(3);
    expect(isClockSkewed(session.state, back)).toBe(true);
    expect(isClockSkewed(session.state, noon(10) - 60_000)).toBe(false);
    const frozen = session.state;
    session.tick(back);
    expect(session.state).toBe(frozen);
    expect(effectiveDay(session.state, back)).toBe(day(10));
    session.tick(noon(11));
    expect(session.state.clock.today).toBe(day(11));
  });

  it('does not believe a clock that jumped far ahead until someone acts', () => {
    const session = plantedSession(noon(0));
    for (let offset = 1; offset <= 7; offset += 1) session.at(noon(offset), water);
    const before = session.state;
    const bogus = localTime('2026-12-01', 9);

    expect(isClockSuspect(before, bogus)).toBe(true);
    session.tick(bogus);
    // Nothing closed, nothing rested, nothing dormant, and no event recorded at that time.
    expect(session.state).toBe(before);
    expect(session.last).toEqual([]);
    expect(before.streak.current).toBe(8);
    expect(before.tree).toMatchObject({ vitality: 'thriving', missed: 0 });

    // The clock is put right: the next day is an ordinary day.
    expect(isClockSkewed(session.state, noon(8))).toBe(false);
    expect(session.at(noon(8), water)).toBe(true);
    const result = session.at(noon(8) + 60_000, (ctx) =>
      logAction(ctx, { actionId: 'plant-based-meal', qty: 1 }),
    );
    expect(result.ok && result.log.day).toBe(day(8));
    expect(session.state.streak.current).toBe(9);
    expect(session.state.clock.today).toBe(day(8));
    expect(Object.values(session.state.marks)).not.toContain('missed');
    expect(checkInvariants(session.state)).toEqual([]);
  });

  it('closes a long absence once a real action confirms the day', () => {
    const session = plantedSession(noon(0));
    session.at(noon(1), water);
    session.tick(noon(60));
    expect(session.state.streak.current).toBe(2);
    expect(session.state.tree.missed).toBe(0);

    expect(session.at(noon(60), water)).toBe(true);
    expect(session.state.clock.today).toBe(day(60));
    expect(session.state.streak.current).toBe(1);
    expect(session.state.days[day(60)]?.returnedFrom).toBe('dormant');
    expect(session.state.tree).toMatchObject({ vitality: 'waking', missed: 0, rings: 3 });
    expect(session.eventsOf('day-rolled')[0]).toMatchObject({ from: day(1), to: day(60) });
    expect(checkInvariants(session.state)).toEqual([]);
  });

  it('still settles an ordinary absence on a passive tick, without counting it as an event', () => {
    const session = plantedSession(noon(0));
    session.tick(noon(12));
    expect(session.state.clock.today).toBe(day(12));
    expect(session.state.tree.vitality).toBe('dormant');
    expect(session.state.clock.lastEventTs).toBe(noon(0));
  });

  it('goes back to the real day when a clock that only ticked ahead is corrected', () => {
    const session = plantedSession(noon(0));
    for (let offset = 1; offset <= 4; offset += 1) session.at(noon(offset), water);
    // The clock reads twelve days ahead while the app is merely open.
    session.tick(noon(16));
    expect(session.state.clock.today).toBe(day(16));
    expect(session.state.rain.bank).toBe(1);
    expect(session.state.tree).toMatchObject({ vitality: 'dormant', missed: 11 });

    // Corrected. A passive tick changes nothing; the first action lands on the real day.
    const ahead = session.state;
    expect(isClockSkewed(ahead, noon(5))).toBe(false);
    session.tick(noon(5));
    expect(session.state).toBe(ahead);

    expect(session.at(noon(5), water)).toBe(true);
    const result = session.at(noon(5) + 60_000, (ctx) =>
      logAction(ctx, { actionId: 'plant-based-meal', qty: 1 }),
    );
    expect(result.ok && result.log.day).toBe(day(5));
    const { state } = session;
    expect(state.clock.today).toBe(day(5));
    expect(state.clock.lastEventTs).toBe(noon(5) + 60_000);
    expect(state.days[day(5)]).toBeDefined();
    expect(Object.keys(state.marks).filter((key) => key > day(5))).toEqual([]);
    expect(state.tree).toMatchObject({ vitality: 'thriving', missed: 0, rings: 6 });
    expect(state.quests.daily?.key).toBe(day(5));
    expect(checkInvariants(state)).toEqual([]);

    // No day is earned twice, and the days in between settle honestly as they pass.
    expect(session.at(noon(5) + 120_000, water)).toBe(false);
    session.at(noon(6), water);
    expect(session.state.streak.current).toBe(state.streak.current + 1);
    session.tick(noon(9));
    expect(session.state.marks[day(7)]).toBeDefined();
    expect(checkInvariants(session.state)).toEqual([]);
  });

  it('gives back the rain a bogus clock spent', () => {
    const session = plantedSession(noon(0));
    session.at(noon(1), water);
    // One day ahead uses the cloud; three more are missed with the bank empty.
    session.tick(localTime(day(3), 0, 1));
    session.tick(localTime(day(6), 0, 1));
    const spent = session.state;
    expect(spent.marks[day(2)]).toBe('rain');
    expect(spent.rain.bank).toBe(0);
    expect(spent.tree.missed).toBe(3);
    session.at(noon(2), water);
    expect(session.state.clock.today).toBe(day(2));
    expect(session.state.rain.bank).toBe(1);
    expect(session.state.streak.current).toBe(1);
    expect(Object.values(session.state.marks)).not.toContain('rain');
    expect(Object.values(session.state.marks)).not.toContain('missed');
    expect(checkInvariants(session.state)).toEqual([]);
  });

  it('keeps the settled day when something was really done on the later day', () => {
    const session = plantedSession(noon(0));
    // A real check-in under a clock ten days ahead, then the clock is corrected.
    session.at(noon(10), water);
    const back = noon(1);
    expect(isClockSkewed(session.state, back)).toBe(true);
    expect(session.at(back, water)).toBe(false);
    const result = session.at(back + 60_000, (ctx) =>
      logAction(ctx, { actionId: 'plant-based-meal', qty: 1 }),
    );
    // Logging is never refused; the ring that was earned is not earned again.
    expect(result.ok && result.log.day).toBe(day(10));
    expect(session.state.clock.today).toBe(day(10));
    expect(session.state.tree.rings).toBe(2);
    expect(checkInvariants(session.state)).toEqual([]);
  });

  it('plants on the real day when the clock was corrected during onboarding', () => {
    const session = new GameSession(createInitialState(noon(40)));
    session.tick(noon(40));
    const planted = plantedSession(noon(40));
    expect(planted.state.profile.plantedDay).toBe(day(40));

    const fresh = new GameSession(createInitialState(noon(40)));
    fresh.at(noon(40), (ctx) => {
      ctx.s.onboarding.step = 1;
    });
    fresh.at(noon(2), (ctx) => {
      ctx.s.onboarding.step = 2;
    });
    expect(fresh.state.clock.today).toBe(day(2));
    expect(isClockSkewed(fresh.state, noon(2))).toBe(false);
  });
});

describe('daylight saving and time zones', () => {
  const original = process.env.TZ;
  afterEach(() => {
    if (original === undefined) delete process.env.TZ;
    else process.env.TZ = original;
  });

  it('keeps one ring per calendar day across a 23-hour and a 25-hour day', () => {
    process.env.TZ = 'Europe/Berlin';
    for (const start of ['2026-03-27', '2026-10-23']) {
      const session = plantedSession(localTime(start, 23, 30));
      for (let offset = 1; offset <= 4; offset += 1) {
        const today = addDays(start, offset);
        expect(session.at(localTime(today, 0, 20), water)).toBe(true);
        expect(session.at(localTime(today, 23, 40), water)).toBe(false);
        expect(dayKey(localTime(today, 23, 40))).toBe(today);
      }
      expect(session.state.streak.current).toBe(5);
      expect(session.state.tree.rings).toBe(5);
      expect(Object.values(session.state.marks)).toEqual(['ring', 'ring', 'ring', 'ring', 'ring']);
      expect(checkInvariants(session.state)).toEqual([]);
    }
  });

  it('survives a jump east and a jump back west without earning a day twice', () => {
    process.env.TZ = 'America/Los_Angeles';
    const start = Date.UTC(2026, 5, 10, 18, 0);
    const session = plantedSession(start);
    const homeDay = session.state.clock.today;
    expect(homeDay).toBe('2026-06-10');

    process.env.TZ = 'Pacific/Kiritimati';
    const abroad = start + 2 * 3600_000;
    expect(dayKey(abroad)).toBe('2026-06-11');
    expect(session.at(abroad, water)).toBe(true);
    expect(session.state.clock.today).toBe('2026-06-11');
    expect(session.state.streak.current).toBe(2);

    process.env.TZ = 'America/Los_Angeles';
    const home = abroad + 3600_000;
    expect(dayKey(home)).toBe('2026-06-10');
    expect(session.at(home, water)).toBe(false);
    expect(effectiveDay(session.state, home)).toBe('2026-06-11');
    expect(session.state.tree.rings).toBe(2);
    const nextMorning = Date.UTC(2026, 5, 12, 16, 0);
    expect(dayKey(nextMorning)).toBe('2026-06-12');
    expect(session.at(nextMorning, water)).toBe(true);
    expect(session.state.streak.current).toBe(3);
    expect(checkInvariants(session.state)).toEqual([]);
  });
});

describe('week strip', () => {
  it('shows the seven day marks as text', () => {
    const session = plantedSession(noon(0));
    closeRing(session, noon(0) + 1000);
    session.at(noon(2), water);
    session.tick(noon(4));
    const strip = weekStrip(session.state, day(4), day(4));
    expect(strip.map((entry) => entry.mark)).toEqual([
      'full',
      'rain',
      'ring',
      'missed',
      'today',
      'none',
      'none',
    ]);
    expect(strip.map((entry) => entry.label)[0]).toBe('Full ring');
    expect(strip[4]).toMatchObject({ isToday: true, isFuture: false });
    expect(strip[5]?.isFuture).toBe(true);
    expect(activeDaysIn(strip)).toBe(2);
  });
});
