import { describe, expect, it } from 'vitest';
import { toBase64Url } from '@/lib/codec';
import { addDays } from '@/lib/dates';
import {
  CHALLENGE_TEMPLATES,
  LINK_ERROR_COPY,
  acceptChallenge,
  addPost,
  challengeInviteText,
  challengeLink,
  challengeProgress,
  challengeResultFor,
  challengeResultText,
  clearJournal,
  createChallenge,
  decodeChallenge,
  decodeChallengeResult,
  deletePost,
  dismissChallenge,
  editPost,
  encodeChallenge,
  encodeChallengeResult,
  hasReaction,
  isChallengeExpired,
  journalPromptIndex,
  journalTagLabel,
  parseChallengeHash,
  searchJournal,
  todayAttachment,
  toggleReaction,
  type ChallengePayload,
} from './community';
import { water } from './engine';
import { logAction } from './logging';
import { createInitialState } from './state';
import { GameSession, localTime, plantedSession } from './testkit';

const MON = '2026-10-05';
const day = (offset: number) => addDays(MON, offset);
const noon = (offset: number) => localTime(day(offset), 12);

describe('journal', () => {
  it('stores a cleaned note with an optional tag and attachment', () => {
    const session = plantedSession(noon(0));
    session.at(noon(0) + 1000, (ctx) => logAction(ctx, { actionId: 'plant-based-meal', qty: 2 }));
    session.at(noon(0) + 5000, (ctx) =>
      logAction(ctx, { actionId: 'walk-cycle-instead-of-car', qty: 5 }),
    );
    const result = session.at(noon(0) + 9000, (ctx) =>
      addPost(ctx, {
        text: '  Cycled to work.\r\nLegs like jelly.\u0007  ',
        tag: 'win',
        attachToday: true,
      }),
    );
    if (!result.ok) throw new Error('refused');
    expect(result.note).toMatchObject({
      day: MON,
      text: 'Cycled to work.\nLegs like jelly.',
      tag: 'win',
      attachment: 'Today: 🌱 ×2 · 🚶 5 km · ≈ 4.1 kg',
      editedTs: null,
    });
    expect(todayAttachment(session.state, day(3))).toBeNull();
    expect(session.at(noon(0) + 9500, (ctx) => addPost(ctx, { text: '   ' }))).toEqual({
      ok: false,
      reason: 'empty',
    });
    const tagged = session.at(noon(0) + 9600, (ctx) =>
      addPost(ctx, { text: 'hm', tag: 'made-up' }),
    );
    expect(tagged.ok && tagged.note.tag).toBeNull();
    const long = session.at(noon(0) + 9700, (ctx) => addPost(ctx, { text: 'x'.repeat(900) }));
    expect(long.ok && long.note.text).toHaveLength(500);
  });

  it('pays 5 XP for the first note of 20 characters in a day, once', () => {
    const session = plantedSession(noon(0));
    const xp = session.state.xp;
    expect(session.at(noon(0) + 1000, (ctx) => addPost(ctx, { text: 'Short one.' }))).toMatchObject(
      { rewarded: false },
    );
    expect(
      session.at(noon(0) + 2000, (ctx) =>
        addPost(ctx, { text: 'This one is long enough to count.' }),
      ),
    ).toMatchObject({
      rewarded: true,
    });
    expect(
      session.at(noon(0) + 3000, (ctx) =>
        addPost(ctx, { text: 'And so is this one, but only one pays.' }),
      ),
    ).toMatchObject({
      rewarded: false,
    });
    expect(session.state.xp).toBe(xp + 5 + 20);
    expect(session.state.days[MON]?.journalRewarded).toBe(true);
    expect(session.state.badges['dear-diary']?.tier).toBe(1);
  });

  it('keeps the reward to one a day even when the note comes before the check-in', () => {
    const session = plantedSession(noon(0));
    const note = session.at(noon(1), (ctx) =>
      addPost(ctx, { text: 'Written before watering the tree.' }),
    );
    expect(note).toMatchObject({ rewarded: true });
    expect(session.state.days[day(1)]).toBeUndefined();
    if (!note.ok) throw new Error('refused');
    session.at(noon(1) + 1000, (ctx) => deletePost(ctx, note.note.id));
    session.at(noon(1) + 2000, water);
    expect(session.state.days[day(1)]?.journalRewarded).toBe(true);
    expect(
      session.at(noon(1) + 3000, (ctx) =>
        addPost(ctx, { text: 'A second long note, the same day.' }),
      ),
    ).toMatchObject({
      rewarded: false,
    });
  });

  it('edits, deletes, searches and clears', () => {
    const session = plantedSession(noon(0));
    const first = session.at(noon(0) + 1000, (ctx) =>
      addPost(ctx, { text: 'Bus was late', tag: 'wobble' }),
    );
    session.at(noon(1), (ctx) => addPost(ctx, { text: 'Lentil curry worked', tag: 'eat' }));
    if (!first.ok) throw new Error('refused');
    const edited = session.at(noon(1) + 1000, (ctx) =>
      editPost(ctx, first.note.id, { text: 'Bus was late, walked instead' }),
    );
    expect(edited.ok && edited.note).toMatchObject({
      text: 'Bus was late, walked instead',
      tag: 'wobble',
      editedTs: noon(1) + 1000,
    });
    expect(session.at(noon(1), (ctx) => editPost(ctx, 'nope', { text: 'x' }))).toEqual({
      ok: false,
      reason: 'not-found',
    });
    expect(session.at(noon(1), (ctx) => editPost(ctx, first.note.id, { text: ' ' }))).toEqual({
      ok: false,
      reason: 'empty',
    });
    expect(searchJournal(session.state.journal, 'CURRY').map((note) => note.tag)).toEqual(['eat']);
    expect(searchJournal(session.state.journal, '', 'wobble')).toHaveLength(1);
    expect(searchJournal(session.state.journal, '').map((note) => note.tag)).toEqual([
      'eat',
      'wobble',
    ]);
    expect(session.at(noon(1) + 2000, (ctx) => deletePost(ctx, first.note.id))).toBe(true);
    expect(session.at(noon(1) + 2000, (ctx) => deletePost(ctx, first.note.id))).toBe(false);
    expect(session.at(noon(1) + 3000, clearJournal)).toBe(1);
    expect(session.state.journal).toEqual([]);
    expect(journalTagLabel('eat')).toBe('Eat');
    expect(journalTagLabel('touch-grass')).toBe('Touch Grass');
    expect(journalTagLabel('wobble')).toBe('Wobble');
  });

  it('rotates twelve weekly prompts', () => {
    expect(journalPromptIndex(MON)).toBe(journalPromptIndex(day(6)));
    expect(journalPromptIndex(day(7))).toBe((journalPromptIndex(MON) + 1) % 12);
    const seen = new Set(
      Array.from({ length: 12 }, (_, week) => journalPromptIndex(day(week * 7))),
    );
    expect(seen.size).toBe(12);
    expect(journalPromptIndex('2020-01-01')).toBeGreaterThanOrEqual(0);
  });

  it('keeps marks on this device and never counts people', () => {
    const session = plantedSession(noon(0));
    expect(
      session.at(noon(0), (ctx) => toggleReaction(ctx, 'editorial:the-30c-habit', 'saved')),
    ).toBe(true);
    expect(hasReaction(session.state, 'editorial:the-30c-habit', 'saved')).toBe(true);
    expect(
      session.at(noon(0), (ctx) => toggleReaction(ctx, 'editorial:the-30c-habit', 'saved')),
    ).toBe(false);
    expect(session.state.reactions).toEqual({});
    expect(session.at(noon(0), (ctx) => toggleReaction(ctx, '', 'saved'))).toBe(false);
  });
});

describe('challenge links', () => {
  const payload: ChallengePayload = {
    v: 1,
    k: 'rings_5',
    s: MON,
    d: 7,
    n: 'Maya',
    t: 'Juniper',
    sp: 'oak',
    m: 'Loser cooks dinner',
  };

  it('round-trips a compact, URL-safe payload', () => {
    const encoded = encodeChallenge(payload)!;
    expect(encoded).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(encoded.length).toBeLessThanOrEqual(300);
    expect(decodeChallenge(encoded)).toEqual({ ok: true, payload });
    expect(challengeInviteText(payload)).toBe(
      'Maya and Juniper dare you: five full rings in 7 days',
    );
    expect(challengeLink('https://example.org/', encoded)).toBe(
      `https://example.org/community#c=${encoded}`,
    );
    expect(parseChallengeHash(`#c=${encoded}`)).toEqual({ kind: 'invite', encoded });
    expect(parseChallengeHash(`r=${encoded}`)).toEqual({ kind: 'result', encoded });
    expect(parseChallengeHash('#c=')).toBeNull();
    expect(parseChallengeHash('#c=<script>')).toBeNull();
    expect(parseChallengeHash('#about')).toBeNull();
  });

  it('fits every template with the longest allowed text', () => {
    for (const template of CHALLENGE_TEMPLATES) {
      const full: ChallengePayload = {
        v: 1,
        k: template.id,
        s: MON,
        d: 7,
        n: 'N'.repeat(20),
        t: 'T'.repeat(16),
        sp: 'cherry',
        m: 'M'.repeat(80),
      };
      if (template.needsCategory) full.c = 'nature';
      const encoded = encodeChallenge(full);
      expect(encoded).not.toBeNull();
      expect(decodeChallenge(encoded!)).toEqual({ ok: true, payload: full });
    }
    expect(encodeChallenge({ ...payload, m: '🌱'.repeat(40) })).toBeNull();
  });

  it('rejects damaged, oversized and unknown links with one calm message', () => {
    const encoded = encodeChallenge(payload)!;
    const flipped = encoded.slice(0, 12) + (encoded[12] === 'A' ? 'B' : 'A') + encoded.slice(13);
    const forged = (fields: unknown) => toBase64Url(JSON.stringify(fields));
    const bad: [string, string][] = [
      [flipped, 'damaged'],
      [encoded.slice(0, -3), 'damaged'],
      ['not base64!', 'damaged'],
      ['', 'too-long'],
      ['A'.repeat(301), 'too-long'],
      [forged({ v: 1, k: 'rings_5', s: MON, d: 7 }), 'damaged'],
      [forged({ v: 1, k: 'rings_5', s: MON, d: 7, x: 1 }), 'damaged'],
      [forged([1, 2, 3]), 'damaged'],
    ];
    for (const [link, error] of bad) expect(decodeChallenge(link)).toEqual({ ok: false, error });
    expect(LINK_ERROR_COPY.damaged).toBe('This link looks damaged. Ask for a fresh one.');
    expect(LINK_ERROR_COPY.expired).toBe('This challenge has ended. Start your own?');
  });

  it('validates every field even when the checksum is right', () => {
    const tamper = (fields: Partial<Record<keyof ChallengePayload, unknown>>) =>
      encodeChallenge({ ...payload, ...fields } as ChallengePayload) ?? '';
    expect(decodeChallenge(tamper({ k: 'steal_everything' }))).toEqual({
      ok: false,
      error: 'unknown-template',
    });
    expect(decodeChallenge(tamper({ s: '2026-13-45' })).ok).toBe(false);
    expect(decodeChallenge(tamper({ s: 'yesterday' })).ok).toBe(false);
    expect(decodeChallenge(tamper({ n: 'x'.repeat(21) })).ok).toBe(false);
    expect(decodeChallenge(tamper({ m: 'x'.repeat(81) })).ok).toBe(false);
    expect(decodeChallenge(tamper({ sp: 'baobab' })).ok).toBe(false);
    expect(decodeChallenge(tamper({ n: 42 })).ok).toBe(false);
    expect(decodeChallenge(tamper({ k: 'cat_15' })).ok).toBe(false);
    const withCategory = decodeChallenge(tamper({ k: 'cat_15', c: 'waste' }));
    expect(withCategory.ok && withCategory.payload.c).toBe('waste');
    const markup = decodeChallenge(tamper({ m: '<img src=x onerror=alert(1)>' }));
    expect(markup.ok && markup.payload.m).toBe('<img src=x onerror=alert(1)>');
  });

  it('expires fourteen days after the start day', () => {
    expect(isChallengeExpired(payload, day(14))).toBe(false);
    expect(isChallengeExpired(payload, day(15))).toBe(true);
  });

  it('round-trips a result card', () => {
    const encoded = encodeChallengeResult({
      v: 1,
      k: 'rings_5',
      n: 'Maya',
      done: 5,
      of: 5,
      on: day(6),
    });
    const decoded = decodeChallengeResult(encoded);
    expect(decoded).toEqual({
      ok: true,
      payload: { v: 1, k: 'rings_5', n: 'Maya', done: 5, of: 5, on: day(6) },
    });
    expect(decoded.ok && challengeResultText(decoded.payload)).toBe(
      'Maya finished: 5 / 5 full rings · self-reported',
    );
    expect(challengeResultText({ v: 1, k: 'rings_5', done: 3, of: 5, on: day(6) })).toBe(
      'Your friend got to: 3 / 5 full rings · self-reported',
    );
    expect(
      decodeChallengeResult(
        encodeChallengeResult({ v: 1, k: 'rings_5', done: 9, of: 5, on: day(6) }),
      ).ok,
    ).toBe(false);
    expect(
      decodeChallengeResult(
        encodeChallengeResult({ v: 1, k: 'rings_5', done: 2, of: 99, on: day(6) }),
      ).ok,
    ).toBe(false);
    expect(decodeChallengeResult(encodeChallenge(payload)!).ok).toBe(false);
  });
});

describe('challenge flow', () => {
  it('creates a link without the name unless asked', () => {
    const session = plantedSession(noon(0));
    const made = session.at(noon(0) + 1000, (ctx) =>
      createChallenge(ctx, { templateId: 'rings_5', message: ' Loser cooks ' }),
    );
    if (!made.ok) throw new Error('refused');
    expect(made.payload).toEqual({
      v: 1,
      k: 'rings_5',
      s: MON,
      d: 7,
      t: 'Fern',
      sp: 'oak',
      m: 'Loser cooks',
    });
    expect(session.state.challenge.active).toMatchObject({
      role: 'creator',
      startDay: MON,
      templateId: 'rings_5',
    });
    const named = plantedSession(noon(0));
    const withName = named.at(noon(0) + 1000, (ctx) =>
      createChallenge(ctx, { templateId: 'show_up_7', includeName: true }),
    );
    expect(withName.ok && withName.payload.n).toBe('Maya');
  });

  it('validates the template and allows one challenge at a time', () => {
    const session = plantedSession(noon(0));
    expect(session.at(noon(0), (ctx) => createChallenge(ctx, { templateId: 'nope' }))).toEqual({
      ok: false,
      reason: 'unknown-template',
    });
    expect(session.at(noon(0), (ctx) => createChallenge(ctx, { templateId: 'cat_15' }))).toEqual({
      ok: false,
      reason: 'needs-category',
    });
    expect(
      session.at(noon(0), (ctx) =>
        createChallenge(ctx, { templateId: 'cat_15', category: 'waste' }),
      ).ok,
    ).toBe(true);
    expect(session.at(noon(1), (ctx) => createChallenge(ctx, { templateId: 'rings_5' }))).toEqual({
      ok: false,
      reason: 'busy',
    });
    expect(session.at(noon(1), dismissChallenge)).toBe(true);
    expect(session.state.challenge.history).toEqual([
      { templateId: 'cat_15', startDay: MON, done: 0, of: 15, success: false },
    ]);
    expect(session.at(noon(1), (ctx) => createChallenge(ctx, { templateId: 'rings_5' })).ok).toBe(
      true,
    );
    const visitor = new GameSession(createInitialState(noon(0)));
    expect(visitor.at(noon(0), (ctx) => createChallenge(ctx, { templateId: 'rings_5' }))).toEqual({
      ok: false,
      reason: 'not-onboarded',
    });
  });

  it('lets a friend accept with their own seven days, and tracks only their side', () => {
    const creator = plantedSession(noon(0));
    const made = creator.at(noon(0) + 1000, (ctx) =>
      createChallenge(ctx, { templateId: 'plates_10', includeName: true }),
    );
    if (!made.ok) throw new Error('refused');

    const friend = plantedSession(noon(3), { name: 'Arjun', treeName: 'Pip' });
    const accepted = friend.at(noon(3) + 1000, (ctx) => acceptChallenge(ctx, made.encoded));
    expect(accepted.ok).toBe(true);
    expect(friend.state.challenge.active).toMatchObject({
      role: 'friend',
      startDay: day(3),
      from: 'Maya',
      fromTree: 'Fern',
      templateId: 'plates_10',
    });
    expect(friend.eventsOf('challenge-accepted')[0]).toMatchObject({ from: 'Maya' });
    for (let offset = 3; offset < 6; offset += 1) {
      friend.at(noon(offset) + 5000, (ctx) =>
        logAction(ctx, { actionId: 'plant-based-meal', qty: 3 }),
      );
    }
    const progress = challengeProgress(friend.state, friend.state.challenge.active!, day(5));
    expect(progress).toMatchObject({
      current: 9,
      target: 10,
      done: false,
      daysLeft: 5,
      ended: false,
    });
    expect(challengeProgress(creator.state, creator.state.challenge.active!, day(5))).toMatchObject(
      { current: 0 },
    );

    const xp = friend.state.xp;
    friend.at(noon(6) + 5000, (ctx) => logAction(ctx, { actionId: 'plant-based-meal', qty: 1 }));
    expect(friend.eventsOf('challenge-completed')[0]).toMatchObject({
      templateId: 'plates_10',
      done: 10,
      of: 10,
      xp: 40,
    });
    expect(friend.state.challenge.active?.completedTs).toBe(noon(6) + 5000);
    expect(friend.state.challenge.history).toEqual([
      { templateId: 'plates_10', startDay: day(3), done: 10, of: 10, success: true },
    ]);
    expect(friend.state.badges.challenger?.tier).toBe(1);
    expect(friend.state.xp).toBeGreaterThanOrEqual(xp + 40 + 40 + 15);
    const result = decodeChallengeResult(challengeResultFor(friend.state, day(6), true)!);
    expect(result.ok && result.payload).toMatchObject({
      k: 'plates_10',
      n: 'Arjun',
      done: 10,
      of: 10,
    });
  });

  it('refuses damaged, expired and overlapping invitations', () => {
    const friend = plantedSession(noon(20));
    const old = encodeChallenge({ v: 1, k: 'rings_5', s: MON, d: 7 })!;
    expect(friend.at(noon(20), (ctx) => acceptChallenge(ctx, old))).toEqual({
      ok: false,
      reason: 'expired',
    });
    expect(friend.at(noon(20), (ctx) => acceptChallenge(ctx, 'garbage'))).toEqual({
      ok: false,
      reason: 'damaged',
    });
    const fresh = encodeChallenge({ v: 1, k: 'rings_5', s: day(19), d: 7 })!;
    expect(friend.at(noon(20), (ctx) => acceptChallenge(ctx, fresh)).ok).toBe(true);
    expect(friend.at(noon(21), (ctx) => acceptChallenge(ctx, fresh))).toEqual({
      ok: false,
      reason: 'busy',
    });
    expect(friend.state.challenge.active?.startDay).toBe(day(20));
  });

  it('ends without penalty when time is up', () => {
    const session = plantedSession(noon(0));
    session.at(noon(0) + 1000, (ctx) => createChallenge(ctx, { templateId: 'show_up_7' }));
    for (let offset = 1; offset < 3; offset += 1) session.at(noon(offset), water);
    const xp = session.state.xp;
    session.tick(noon(7));
    expect(session.eventsOf('challenge-ended')[0]).toMatchObject({ done: 3, of: 7 });
    expect(session.state.challenge.active).toBeNull();
    expect(session.state.challenge.history).toEqual([
      { templateId: 'show_up_7', startDay: MON, done: 3, of: 7, success: false },
    ]);
    expect(
      session.state.notices.find((notice) => notice.kind === 'challenge-ended')?.data,
    ).toMatchObject({ done: 3, of: 7 });
    expect(session.state.xp).toBe(xp);
    const result = decodeChallengeResult(challengeResultFor(session.state, day(7), false)!);
    expect(result.ok && result.payload).toMatchObject({ done: 3, of: 7 });
    expect(result.ok && result.payload.n).toBeUndefined();
  });

  it('pays the challenge reward once per week', () => {
    const session = plantedSession(noon(0));
    session.at(noon(0) + 1000, (ctx) => createChallenge(ctx, { templateId: 'grass_3' }));
    session.state = {
      ...session.state,
      breaks: [0, 1, 2].map((offset) => ({
        id: `b${offset}`,
        startTs: noon(offset),
        endTs: noon(offset) + 600_000,
        day: day(offset),
        plannedMin: 10,
        keptMin: 10,
        awayMs: 600_000,
        kept: true,
        outcome: 'outside' as const,
        xp: 0,
        gp: 0,
      })),
    };
    session.tick(noon(2));
    expect(session.eventsOf('challenge-completed')[0]?.xp).toBe(40);
    session.at(noon(3), dismissChallenge);
    session.at(noon(3) + 1000, (ctx) => createChallenge(ctx, { templateId: 'grass_3' }));
    session.state = {
      ...session.state,
      breaks: [
        ...session.state.breaks,
        ...[3, 4, 5].map((offset) => ({
          ...session.state.breaks[0]!,
          id: `b${offset}`,
          day: day(offset),
          startTs: noon(offset),
          endTs: noon(offset) + 600_000,
        })),
      ],
    };
    session.tick(noon(5));
    expect(session.eventsOf('challenge-completed')[0]?.xp).toBe(0);
    expect(session.state.challenge.history.filter((entry) => entry.success)).toHaveLength(2);
  });
});
