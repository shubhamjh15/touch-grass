import { describe, expect, it } from 'vitest';
import { EPICS } from '@/data/quests';
import type { EpicStatus, QuestClaim, QuestView } from '@/game';
import {
  autoClaimSentence,
  autoClaimsToday,
  countdownText,
  deckOrder,
  epicGap,
  epicStarted,
  epicSteps,
  formLines,
  groupEpics,
  headerSlug,
  parseTab,
  questCategory,
  questHint,
  tabCounts,
  tabHref,
  ticketProgress,
  ticketState,
  weekEndsAt,
  weeklyLeft,
  withFormLine,
  type HintContext,
} from './model';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

function quest(patch: Partial<QuestView> & Pick<QuestView, 'id'>): QuestView {
  return {
    kind: 'daily',
    slot: 0,
    title: patch.id,
    copy: '',
    xp: 15,
    pool: 'easy',
    progress: { current: 0, target: 1, done: false },
    progressText: '0 / 1',
    ratio: 0,
    claimed: false,
    claimable: false,
    canSwap: true,
    actions: [],
    ...patch,
  };
}

function epic(id: string, patch: Partial<EpicStatus> = {}): EpicStatus {
  const def = EPICS.find((entry) => entry.id === id);
  if (!def) throw new Error(`no epic ${id}`);
  return {
    epic: def,
    progress: def.requirement
      ? { current: 0, target: 1, done: false }
      : { current: 1, target: 1, done: true },
    saved: { checklist: [], note: '', claimedTs: null },
    selfAttested: def.attestation !== null,
    attestationFilled: false,
    claimed: false,
    claimable: false,
    cooldownDays: 0,
    pinned: false,
    ...patch,
  };
}

const context: HintContext = {
  hidden: new Set(),
  checkedInToday: false,
  hour: 8,
  treeName: 'Fern',
};

describe('tabs', () => {
  it('reads the tab from the URL and falls back to daily', () => {
    expect(parseTab('weekly')).toBe('weekly');
    expect(parseTab('epics')).toBe('epics');
    expect(parseTab(null)).toBe('daily');
    expect(parseTab('nonsense')).toBe('daily');
  });

  it('keeps the bare path for daily and drops the coach parameter', () => {
    expect(tabHref('daily')).toBe('/quests');
    expect(tabHref('weekly')).toBe('/quests?tab=weekly');
    expect(tabHref('epics', 'tab=weekly&coach=1')).toBe('/quests?tab=epics');
    expect(tabHref('daily', 'tab=epics')).toBe('/quests');
  });

  it('counts what is still to claim on each board', () => {
    const board = {
      daily: [quest({ id: 'a', claimed: true }), quest({ id: 'b' }), quest({ id: 'c' })],
      weekly: [quest({ id: 'd', claimed: true })],
      epics: [epic('e_green_power'), epic('e_bin_audit', { claimed: true })],
    };
    expect(tabCounts(board as never)).toEqual({ daily: 2, weekly: 0, epics: 1 });
  });
});

describe('the deck', () => {
  it('puts claimable tickets first, then open ones, then claimed, keeping the drawn order', () => {
    const order = deckOrder([
      quest({ id: 'claimed', slot: 0, claimed: true }),
      quest({ id: 'open-b', slot: 2 }),
      quest({ id: 'ready', slot: 1, claimable: true }),
      quest({ id: 'open-a', slot: 1 }),
    ]).map((entry) => entry.id);
    expect(order).toEqual(['ready', 'open-a', 'open-b', 'claimed']);
  });

  it('keeps a finished quest claimable after its period ends and expires the rest', () => {
    expect(ticketState({ claimed: true, claimable: false }, true)).toBe('claimed');
    expect(ticketState({ claimed: false, claimable: true }, true)).toBe('claimable');
    expect(ticketState({ claimed: false, claimable: false }, true)).toBe('expired');
    expect(ticketState({ claimed: false, claimable: false }, false)).toBe('active');
  });

  it('gives themed pools their category and the general ones none', () => {
    expect(questCategory('move')).toBe('move');
    expect(questCategory('nature')).toBe('nature');
    expect(questCategory('easy')).toBeUndefined();
    expect(questCategory('consistency')).toBeUndefined();
    expect(questCategory('any')).toBeUndefined();
  });

  it('never rounds a part-walked kilometre up', () => {
    expect(ticketProgress({ progress: { current: 4.6, target: 5, done: false } })).toEqual({
      value: 4,
      max: 5,
    });
  });
});

describe('time left', () => {
  it('counts down in hours and minutes, and in seconds only during the last minute', () => {
    expect(countdownText(9 * HOUR + 28 * MINUTE + 30_000)).toBe('9 h 28 min');
    expect(countdownText(2 * HOUR)).toBe('2 h');
    expect(countdownText(28 * MINUTE + 59_000)).toBe('28 min');
    expect(countdownText(41_200)).toBe('42 sec');
    expect(countdownText(0)).toBe('now');
    expect(countdownText(-5)).toBe('now');
  });

  it('counts the days of the week, today included', () => {
    expect(weeklyLeft(4)).toBe('4 days left');
    expect(weeklyLeft(2)).toBe('2 days left');
    expect(weeklyLeft(1)).toBe('Ends tonight');
    expect(headerSlug(4)).toBe('4 days left this week');
    expect(headerSlug(1)).toBe('Week ends tonight');
  });

  it('ends the week at the first moment of next Monday, local time', () => {
    const tuesday = new Date(2026, 9, 6, 10, 30).getTime();
    const end = new Date(weekEndsAt(tuesday));
    expect([end.getFullYear(), end.getMonth(), end.getDate()]).toEqual([2026, 9, 12]);
    expect([end.getDay(), end.getHours(), end.getMinutes()]).toEqual([1, 0, 0]);
    // A Sunday night still belongs to the week that ends that midnight.
    const sunday = new Date(2026, 9, 11, 23, 59).getTime();
    expect(weekEndsAt(sunday)).toBe(end.getTime());
  });
});

describe('what moves a quest forward', () => {
  it('links the qualifying actions to a prefilled log, marked as coming from a quest', () => {
    const hint = questHint(
      quest({
        id: 'd_muscle_power',
        pool: 'move',
        actions: ['walk-cycle-instead-of-car', 'ebike-escooter-instead-of-car'],
      }),
      context,
    );
    expect(hint.actions.map((action) => action.label)).toEqual([
      'Walked or cycled',
      'E-bike or scooter',
    ]);
    expect(hint.actions[0]?.href).toBe('/log?a=walk-cycle-instead-of-car&src=quest');
    expect(hint.actions[0]?.category).toBe('move');
    expect(hint.step).toBeNull();
  });

  it('never suggests an action the user hid', () => {
    const hint = questHint(
      quest({
        id: 'd_muscle_power',
        actions: ['walk-cycle-instead-of-car', 'ebike-escooter-instead-of-car'],
      }),
      { ...context, hidden: new Set(['ebike-escooter-instead-of-car']) },
    );
    expect(hint.actions.map((action) => action.id)).toEqual(['walk-cycle-instead-of-car']);
  });

  it('prefills the distance still missing on a distance quest', () => {
    const hint = questHint(
      quest({
        id: 'd_five_k',
        actions: ['walk-cycle-instead-of-car'],
        progress: { current: 1.5, target: 5, done: false },
      }),
      context,
    );
    expect(hint.actions[0]?.href).toBe('/log?a=walk-cycle-instead-of-car&q=4&src=quest');
  });

  it('offers one next step when no single action counts', () => {
    expect(questHint(quest({ id: 'd_full_ring' }), context).step).toEqual({
      kind: 'link',
      label: 'Log an action',
      href: '/log',
    });
    expect(questHint(quest({ id: 'd_touch_grass' }), context).step).toEqual({
      kind: 'link',
      label: 'Start a break',
      href: '/today?break=1',
    });
    expect(questHint(quest({ id: 'd_brain_food' }), context).step?.label).toBe('Open Learn');
    expect(questHint(quest({ id: 'd_dear_diary' }), context).step?.label).toBe('Write a note');
    expect(questHint(quest({ id: 'd_coach_pick' }), context).step?.label).toBe('Ask Moss');
    expect(questHint(quest({ id: 'w_double_sweep', kind: 'weekly' }), context).step).toEqual({
      kind: 'tab',
      label: "See today's three",
      tab: 'daily',
    });
  });

  it('points First light at the watering can first, then at the log', () => {
    expect(questHint(quest({ id: 'd_first_light' }), context).step).toEqual({
      kind: 'link',
      label: 'Water Fern',
      href: '/today',
    });
    expect(
      questHint(quest({ id: 'd_first_light' }), { ...context, checkedInToday: true }).step?.label,
    ).toBe('Log an action');
  });

  it('says so, kindly, when Early bird can no longer be caught today', () => {
    const open = questHint(quest({ id: 'd_early_bird' }), context);
    expect(open.note).toBeNull();
    expect(open.step?.label).toBe('Water Fern');
    const late = questHint(quest({ id: 'd_early_bird' }), { ...context, hour: 10.5 });
    expect(late.note).toBe('That window closed at 10:00. Swap it, or catch it tomorrow.');
    expect(late.step).toBeNull();
    const wateredLate = questHint(quest({ id: 'd_early_bird' }), {
      ...context,
      checkedInToday: true,
    });
    expect(wateredLate.note).not.toBeNull();
  });

  it('has nothing to suggest once a quest is done', () => {
    const done = quest({
      id: 'd_muscle_power',
      actions: ['walk-cycle-instead-of-car'],
      progress: { current: 1, target: 1, done: true },
      claimable: true,
    });
    expect(questHint(done, context)).toEqual({ actions: [], step: null, note: null });
  });
});

describe('claimed while away', () => {
  const today = '2026-10-06';
  const at = (hour: number) => new Date(2026, 9, 6, hour).getTime();
  const claim = (patch: Partial<QuestClaim>): QuestClaim => ({
    questId: 'd_first_light',
    kind: 'daily',
    period: '2026-10-05',
    ts: at(0),
    xp: 15,
    auto: true,
    ...patch,
  });

  it('lists only what was settled today, per board', () => {
    const claims = [
      claim({}),
      claim({ questId: 'd_double_up', auto: false }),
      claim({ questId: 'd_plant_plate', ts: new Date(2026, 9, 5, 0).getTime() }),
      claim({ questId: 'w_four_rings', kind: 'weekly', period: 'W2026-09-28', xp: 80 }),
    ];
    expect(autoClaimsToday(claims, 'daily', today)).toEqual([
      { questId: 'd_first_light', title: 'First light', xp: 15 },
    ]);
    expect(autoClaimsToday(claims, 'weekly', today)).toEqual([
      { questId: 'w_four_rings', title: 'Four full rings', xp: 80 },
    ]);
  });

  it('writes the note in one sentence', () => {
    expect(autoClaimSentence([])).toBe('');
    expect(autoClaimSentence([{ questId: 'a', title: 'Cold snap', xp: 40 }])).toBe(
      'Claimed for you while you were away: Cold snap, +40 XP.',
    );
    const many = ['One', 'Two', 'Three', 'Four', 'Five'].map((title) => ({
      questId: title,
      title,
      xp: 20,
    }));
    expect(autoClaimSentence(many)).toBe(
      'Claimed for you while you were away: One, +20 XP · Two, +20 XP · Three, +20 XP · and 2 more. +100 XP in all.',
    );
  });
});

describe('epics', () => {
  it('counts the jobs of a self-attested epic', () => {
    expect(epicSteps(epic('e_green_power'))).toEqual({ done: 0, total: 0 });
    expect(
      epicSteps(
        epic('e_energy_checkup', {
          saved: { checklist: [true, false, true], note: '', claimedTs: null },
        }),
      ),
    ).toEqual({ done: 2, total: 5 });
    expect(epicSteps(epic('e_bin_audit'), 'cans → refill\n\nbags → tote')).toEqual({
      done: 2,
      total: 3,
    });
    expect(
      epicSteps(epic('e_advocate', { progress: { current: 1, target: 1, done: true } }), ''),
    ).toEqual({ done: 1, total: 2 });
  });

  it('names what still stands between an epic and its confirmation', () => {
    expect(epicGap(epic('e_green_power'))).toBeNull();
    expect(epicGap(epic('e_plant_a_real_one'))).toBe('requirement');
    expect(epicGap(epic('e_energy_checkup'))).toBe('checklist');
    expect(
      epicGap(
        epic('e_energy_checkup', {
          saved: { checklist: [true, true, true, true, true], note: '', claimedTs: null },
        }),
      ),
    ).toBeNull();
    expect(epicGap(epic('e_bin_audit'), 'one\ntwo')).toBe('form');
    expect(epicGap(epic('e_bin_audit'), 'one\ntwo\nthree')).toBeNull();
    const logged = { progress: { current: 1, target: 1, done: true } };
    expect(epicGap(epic('e_advocate', logged), ' ')).toBe('note');
    expect(epicGap(epic('e_advocate', logged), 'Bus lanes on the ring road')).toBeNull();
    expect(epicGap(epic('e_green_power', { cooldownDays: 5 }))).toBe('cooldown');
    expect(epicGap(epic('e_green_power', { claimed: true }))).toBeNull();
    // Automatic epics are never "attested".
    expect(epicGap(epic('e_thirty_rings'))).toBeNull();
  });

  it('knows when an epic has been begun', () => {
    expect(epicStarted(epic('e_green_power'))).toBe(false);
    expect(
      epicStarted(epic('e_green_power', { saved: { checklist: [], note: 'x', claimedTs: null } })),
    ).toBe(true);
    expect(
      epicStarted(epic('e_mend_and_make_do', { progress: { current: 2, target: 5, done: false } })),
    ).toBe(true);
  });

  it('sorts epics into ready, on your word, from your logs and finished', () => {
    const all = [
      epic('e_energy_checkup'),
      epic('e_green_power', { pinned: true }),
      epic('e_thirty_rings', {
        claimable: true,
        progress: { current: 30, target: 30, done: true },
      }),
      epic('e_mend_and_make_do', { progress: { current: 2, target: 5, done: false } }),
      epic('e_car_light_month'),
      epic('e_climate_literate', {
        claimed: true,
        saved: { checklist: [], note: '', claimedTs: 2 },
      }),
      epic('e_bin_audit', { claimed: true, saved: { checklist: [], note: 'x', claimedTs: 5 } }),
    ];
    const groups = groupEpics(all);
    const ids = (list: EpicStatus[]) => list.map((status) => status.epic.id);
    expect(ids(groups.ready)).toEqual(['e_thirty_rings']);
    expect(ids(groups.onYourWord)).toEqual(['e_green_power', 'e_energy_checkup']);
    expect(ids(groups.fromLogs)).toEqual(['e_mend_and_make_do', 'e_car_light_month']);
    expect(ids(groups.finished)).toEqual(['e_bin_audit', 'e_climate_literate']);
  });

  it('leaves an epic claimed during this visit where it was', () => {
    const all = [
      epic('e_green_power', { claimed: true, saved: { checklist: [], note: '', claimedTs: 9 } }),
      epic('e_thirty_rings', { claimed: true, saved: { checklist: [], note: '', claimedTs: 8 } }),
    ];
    const groups = groupEpics(all, new Set(['e_green_power', 'e_thirty_rings']));
    expect(groups.onYourWord).toHaveLength(1);
    expect(groups.ready).toHaveLength(1);
    expect(groups.finished).toHaveLength(0);
  });

  it('stores a three-line form as one note', () => {
    expect(formLines('', 3)).toEqual(['', '', '']);
    expect(formLines('a\nb', 3)).toEqual(['a', 'b', '']);
    expect(withFormLine('a\nb', 3, 2, 'c')).toBe('a\nb\nc');
    expect(withFormLine('', 3, 1, 'pasted\ntext')).toBe('\npasted text\n');
  });
});
