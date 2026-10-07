import { describe, expect, it } from 'vitest';
import { parseCoachText } from '../chips';
import type { CoachContext } from '../contract';
import { matchIntent, normalise, type IntentId } from './intents';
import { OFFLINE_LABEL, QUICK_PROMPTS } from './knowledge';
import { offlineTip, respondOffline } from './respond';
import { runOfflineCoach, splitWords, streamOfflineText } from './stream';

const context: CoachContext = {
  displayName: 'Alex',
  region: 'eu',
  tree: { name: 'Juniper', species: 'oak', stage: 'Sapling', vitality: 'thriving' },
  streak: 9,
  rain: 1,
  focus: ['eat', 'move'],
  totals: { kgTotal: 11.3, actionsTotal: 14 },
  topCategories: [{ category: 'food', count: 9 }],
  quests: [
    { id: 'd_plant_day', line: 'Log 3 plant-based meals (1/3)', progress: 0.33 },
    { id: 'w_commuter', line: 'Ride or walk 3 trips (2/3)', progress: 0.66 },
  ],
  baseline: '7.5 t a year, mostly travel and home',
  lessonSlugs: ['the-blanket', 'recycling-honestly'],
  actions: [
    { id: 'eat_veg_meal', title: 'Vegetarian meal', unit: 'meals', category: 'eat' },
    { id: 'eat_plant_meal', title: 'Fully plant-based meal', unit: 'meals', category: 'eat' },
    { id: 'move_bike_trip', title: 'Cycled instead of driving', unit: 'km', category: 'move' },
    { id: 'move_walk_trip', title: 'Walked instead of driving', unit: 'km', category: 'move' },
    { id: 'power_heat_down', title: 'Heating lower than usual', unit: '°C', category: 'power' },
    { id: 'water_cold_wash', title: 'Laundry at 30 °C or cold', unit: 'loads', category: 'water' },
    { id: 'stuff_repair', title: 'Repaired instead of replacing', unit: 'item', category: 'stuff' },
    { id: 'waste_recycle', title: 'Sorted recycling', unit: 'bag', category: 'waste' },
  ],
};

const intentOf = (message: string): IntentId => matchIntent(message).intent;

describe('intent matching', () => {
  it('maps every quick prompt to its own intent', () => {
    for (const prompt of [...QUICK_PROMPTS.primary, ...QUICK_PROMPTS.more]) {
      expect(intentOf(prompt.label)).toBe(prompt.id);
    }
  });

  it.each<[string, IntentId]>([
    ['hi', 'greeting'],
    ['Hello there', 'greeting'],
    ['good morning', 'greeting'],
    ['thanks!', 'thanks'],
    ['thank you so much', 'thanks'],
    ['bye', 'goodbye'],
    ['how are you?', 'how_are_you'],
    ['who are you', 'who_are_you'],
    ['are you a bot?', 'who_are_you'],
    ['tell me a joke', 'joke'],
    ['what should I do today', 'easy_win'],
    ['where do I start', 'easy_win'],
    ['what matters most?', 'biggest_lever'],
    ['how accurate are these kg numbers', 'explain_numbers'],
    ['What is CO2e?', 'what_is_co2e'],
    ['what does co2e mean', 'what_is_co2e'],
    ['I missed a day, did I lose my streak', 'streak'],
    ['what are rain clouds', 'streak'],
    ['why is my tree thirsty', 'tree_status'],
    ['my tree looks sad', 'tree_status'],
    ['what vegan recipe for dinner', 'food'],
    ['can I eat less meat', 'food'],
    ['I have leftovers', 'food_waste'],
    ['should I cycle to work or take the bus', 'transport'],
    ['is flying bad', 'flying'],
    ['planning a flight to Spain', 'flying'],
    ['how do I cut my heating bill', 'home_energy'],
    ['should I buy second hand clothes', 'stuff_waste'],
    ['does plastic recycling work', 'recycling_worth'],
    ['cheap ways to be greener', 'money_swap'],
    ['what are my weekly quests', 'quests'],
    ['I feel hopeless about all this', 'anxiety'],
    ['eco-anxiety is getting to me', 'anxiety'],
    ['how do XP and levels work', 'how_it_works'],
    ['do I need an api key for the live coach', 'enable_live'],
    ['are you chatgpt', 'who_are_you'],
    ['write me a python script', 'off_topic'],
    ['which party should I vote for', 'off_topic'],
    ['what medication should I take', 'off_topic'],
  ])('%s -> %s', (message, expected) => {
    expect(intentOf(message)).toBe(expected);
  });

  it('is honest about what it does not know', () => {
    for (const message of [
      '',
      '   ',
      'qwerty zxcv',
      'the quick brown fox',
      'Qué hago hoy',
      '???',
      '12345',
    ]) {
      expect(intentOf(message)).toBe('unknown');
    }
  });

  it('ignores case, accents, punctuation and hyphens', () => {
    expect(normalise("  What's MY biggest-lever??? ")).toBe('whats my biggest lever');
    expect(intentOf("WHAT'S MY BIGGEST LEVER???")).toBe('biggest_lever');
    expect(intentOf('café dinner idea')).toBe('food');
  });

  it('always puts a safety message first, even among other topics', () => {
    for (const message of [
      'I want to kill myself',
      'sometimes I think I should just end my life',
      'the climate news makes me want to die',
      'i keep wanting to hurt myself, and my food diet is fine',
      'no reason to live, what is my streak',
    ]) {
      expect(intentOf(message)).toBe('crisis');
    }
  });

  it('is deterministic', () => {
    for (let i = 0; i < 20; i += 1) {
      expect(respondOffline('what should I eat for dinner', context)).toEqual(
        respondOffline('what should I eat for dinner', context),
      );
    }
  });
});

describe('answers', () => {
  it('never claims to be the live model', () => {
    for (const message of [
      'hi',
      'who are you',
      'do you use ai',
      'qwerty',
      'what is co2e',
      'how are you',
    ]) {
      const reply = respondOffline(message, context);
      expect(reply.label).toBe(OFFLINE_LABEL);
      expect(reply.text).not.toMatch(/as an ai|language model trained|i am (a )?large/i);
    }
    expect(respondOffline('who are you', context).text).toMatch(/not an AI model/);
    expect(respondOffline('qwerty', context).text).toMatch(/built-in coach/);
    expect(respondOffline('api key please', context).text).toMatch(/built-in coach/);
  });

  it('handles a crisis with warmth and a pointer to people, never coaching', () => {
    const reply = respondOffline('I want to kill myself', context);
    expect(reply.intent).toBe('crisis');
    expect(reply.text).toMatch(/emergency number/);
    expect(reply.text).toMatch(/findahelpline\.com/);
    expect(reply.text).not.toMatch(/\[\[/);
    expect(reply.text).not.toMatch(/streak|XP|log /i);
  });

  it('personalises with the name, tree, streak, rain, totals and baseline', () => {
    expect(respondOffline('hi', context).text).toMatch(/Alex/);
    expect(respondOffline('hi', context).text).toMatch(/Juniper is thriving/);
    const streakText = respondOffline('what is my streak', context).text;
    expect(streakText).toMatch(/9 days/);
    expect(streakText).toMatch(/1 rain cloud banked/);
    expect(respondOffline('explain my numbers', context).text).toMatch(
      /≈ 11 kg avoided across 14 actions/,
    );
    expect(respondOffline("what's my biggest lever", context).text).toMatch(
      /7\.5 t a year, mostly travel and home/,
    );
    expect(respondOffline('why is my tree thirsty', context).text).toMatch(/Juniper is thriving/);
  });

  it('falls back gracefully with an empty context', () => {
    for (const message of [
      'hi',
      'one easy win',
      'my streak',
      'my tree',
      'quests',
      'biggest lever',
      'dinner',
      'cycling',
    ]) {
      const reply = respondOffline(message, {});
      expect(reply.text.length).toBeGreaterThan(20);
      expect(reply.text).not.toMatch(/undefined|null|NaN|\{\{/);
    }
    expect(respondOffline('hi', {}).text).toMatch(/^Hi\.|^Hey\.|^Hello\./);
    expect(respondOffline('my tree', {}).text).toMatch(/Your tree gets thirsty/);
  });

  it('points to the quest closest to done', () => {
    const reply = respondOffline('help me finish this weeks quests', context);
    expect(reply.text).toMatch(/Ride or walk 3 trips \(2\/3\)/);
    expect(reply.text).toContain('[[quest:w_commuter]]');
    expect(respondOffline('quests', { ...context, quests: [] }).text).toMatch(
      /can't see any quests/,
    );
    expect(
      respondOffline('quests', { quests: [{ id: 'a', line: 'x', progress: 1 }] }).text,
    ).toMatch(/Every open quest is done/);
  });

  it('describes a thirsty or resting tree and mentions watering when it suggests something', () => {
    const thirsty = { ...context, tree: { ...context.tree, vitality: 'thirsty' } };
    expect(respondOffline('why is my tree sad', thirsty).text).toMatch(
      /Juniper is thirsty right now/,
    );
    expect(respondOffline('one easy win', thirsty).text).toMatch(
      /thirsty, and any log counts as water/,
    );
    const dormant = { ...context, tree: { ...context.tree, vitality: 'dormant' } };
    expect(respondOffline('one easy win', dormant).text).toMatch(
      /resting, and one log wakes it up/,
    );
  });

  it('handles singular and zero streaks', () => {
    expect(respondOffline('streak', { ...context, streak: 1, rain: 0 }).text).toMatch(/1 day\./);
    expect(respondOffline('streak', { ...context, streak: 0 }).text).toMatch(
      /No streak is running yet/,
    );
  });

  it('varies phrasing between different messages but not between repeats', () => {
    const answers = new Set(
      [
        'dinner ideas',
        'what to eat tonight',
        'vegan meal please',
        'a recipe',
        'plan a meal',
        'cooking tips',
      ].map((m) => respondOffline(m, context).text),
    );
    expect(answers.size).toBeGreaterThan(1);
  });
});

describe('chips', () => {
  const allIds = new Set(context.actions?.map((a) => a.id));
  const messages = [
    'one easy win',
    'dinner',
    'cycling to work',
    'heating bill',
    'repair my clothes',
    'recycling worth it',
    'a swap that saves money',
    'flying',
    'leftovers',
    'help me finish this weeks quests',
    "I'm feeling climate anxious",
    'what is co2e',
    "what's my biggest lever",
  ];

  it('only ever offers actions the context contains, and every chip survives the real parser', () => {
    for (const message of messages) {
      const { text } = respondOffline(message, context);
      const tokens = [...text.matchAll(/\[\[([a-z]+):([^\]?]+)/g)];
      for (const token of tokens) {
        if (token[1] === 'log') expect(allIds.has(token[2] ?? '')).toBe(true);
      }
      const parsed = parseCoachText(text, {
        actions: allIds,
        lessonSlugs: context.lessonSlugs,
        questIds: context.quests?.map((q) => q.id),
      });
      expect(parsed.filter((s) => s.type === 'chip')).toHaveLength(tokens.length);
      expect(tokens.length).toBeLessThanOrEqual(3);
      expect(
        parsed
          .filter((s) => s.type === 'text')
          .map((s) => (s.type === 'text' ? s.text : ''))
          .join(''),
      ).not.toMatch(/\[\[/);
    }
  });

  it('offers no log chips when the context has no actions', () => {
    for (const message of messages) {
      expect(respondOffline(message, { ...context, actions: [] }).text).not.toMatch(/\[\[log:/);
    }
  });

  it('skips actions that are already maxed today', () => {
    const maxed: CoachContext = {
      ...context,
      actions: context.actions?.map((a) =>
        a.id === 'eat_plant_meal' ? { ...a, doneToday: true } : a,
      ),
    };
    const text = respondOffline('dinner', maxed).text;
    expect(text).not.toContain('[[log:eat_plant_meal]]');
    expect(text).toContain('[[log:eat_veg_meal]]');
  });

  it('suggests an action in a focus area first', () => {
    expect(respondOffline('one easy win', context).text).toMatch(/focus areas/);
    const wide: CoachContext = { ...context, focus: ['water'] };
    expect(respondOffline('one easy win', wide).text).toContain('[[log:water_cold_wash]]');
  });

  it('ignores action ids that would be unsafe to put in a token', () => {
    const hostile: CoachContext = {
      actions: [{ id: 'x]] [[log:other', title: 'Bad', unit: 'once' }],
    };
    expect(respondOffline('one easy win', hostile).text).not.toMatch(/\[\[log:x/);
  });

  it('adds learn chips only for lessons the context knows', () => {
    expect(respondOffline('is recycling worth it', context).text).toContain(
      '[[learn:recycling-honestly]]',
    );
    expect(
      respondOffline('is recycling worth it', { ...context, lessonSlugs: [] }).text,
    ).not.toContain('[[learn:');
  });
});

describe('climate facts stay conservative', () => {
  it('uses only a small set of numbers, all hedged or well known', () => {
    const allowed = new Set([
      '1',
      '2',
      '3',
      '5',
      '10',
      '30',
      '60',
      '100',
      '988',
      '7.5',
      '9',
      '14',
      '11',
      '300',
    ]);
    const everything = [
      'one easy win',
      "what's my biggest lever",
      'explain my numbers',
      'what is co2e',
      'streak',
      'why is my tree thirsty',
      'dinner',
      'leftovers',
      'commute',
      'flying',
      'heating',
      'clothes',
      'recycling worth it',
      'save money',
      'quests',
      'anxious',
      'how does it work',
      'api key',
      'who are you',
      'qwerty',
      'I want to kill myself',
    ].map((m) => respondOffline(m, {}).text);
    for (const text of everything) {
      const withoutChips = text.replace(/\[\[[^\]]*\]\]/g, '');
      for (const number of withoutChips.match(/\d+(?:\.\d+)?/g) ?? []) {
        expect(allowed.has(number), `unexpected number ${number} in: ${text}`).toBe(true);
      }
    }
  });

  it('hedges percentages and avoids absolute claims', () => {
    expect(respondOffline('heating', {}).text).toMatch(/roughly 5 to 10%/);
    expect(respondOffline('commute', {}).text).toMatch(/typically/);
    expect(respondOffline('flying', {}).text).toMatch(/can add up to/);
    expect(respondOffline('dinner', {}).text).toMatch(/Beef and lamb/);
  });

  it('answers about the topic when a plain question names one', () => {
    expect(matchIntent('what should i do about my commute?').intent).toBe('transport');
    expect(matchIntent('What can I do about my heating bill?').intent).toBe('home_energy');
    expect(matchIntent('what should i do today?').intent).toBe('easy_win');
  });
});

describe('offlineTip', () => {
  it('follows the priority: thirsty tree, near-done quest, focus action, fact', () => {
    const thirsty = { ...context, tree: { ...context.tree, vitality: 'thirsty' } };
    expect(offlineTip(thirsty).text).toMatch(/Juniper is thirsty/);
    expect(offlineTip(context).text).toMatch(/Nearly there on Ride or walk 3 trips/);
    const noQuests = { ...context, quests: [] };
    expect(offlineTip(noQuests).text).toMatch(/Easy one in your focus area/);
    expect(offlineTip({}, 3).text).toMatch(/\.$/);
    expect(offlineTip({}, 0).text).not.toBe(offlineTip({}, 1).text);
  });
});

describe('offlineTip: the rest of the spec priority', () => {
  it('suggests closing the ring, then an unpassed lesson, then a fact', () => {
    const base: CoachContext = {
      actions: context.actions,
      tree: { name: 'Juniper', vitality: 'thriving' },
    };
    expect(offlineTip({ ...base, ringLeft: 2 }).text).toMatch(/2 more actions close today's ring/);
    expect(offlineTip({ ...base, ringLeft: 1 }).text).toMatch(/1 more action closes/);
    const lesson = offlineTip({
      nextLesson: { slug: 'the-blanket', title: 'The [blanket] <around> us' },
    });
    expect(lesson.text).toMatch(/The blanket around us/);
    expect(lesson.text).toContain('[[learn:the-blanket]]');
    expect(offlineTip({ nextLesson: { slug: 'bad slug]]', title: 'x' } }, 2).text).not.toContain(
      '[[learn:',
    );
  });
});

describe('streaming', () => {
  it('splits text so the pieces rebuild it exactly', () => {
    const text = '  Hello   there,\nfriend!\n\n[[log:eat_veg_meal]]\n';
    expect(splitWords(text).join('')).toBe(text);
    expect(splitWords('')).toEqual([]);
  });

  it('delivers word by word through onDelta, with the running text', async () => {
    const seen: [string, string][] = [];
    const sleeps: number[] = [];
    const result = await streamOfflineText('One easy win\n[[log:a]]', {
      onDelta: (piece, full) => seen.push([piece, full]),
      sleep: async (ms) => {
        sleeps.push(ms);
      },
    });
    expect(result).toBe('One easy win\n[[log:a]]');
    expect(seen.map(([piece]) => piece)).toEqual(['One ', 'easy ', 'win\n', '[[log:a]]']);
    expect(seen.at(-1)?.[1]).toBe(result);
    expect(sleeps).toHaveLength(3);
  });

  it('delivers everything at once with no delay', async () => {
    let sleeps = 0;
    const result = await streamOfflineText('a b c', {
      wordDelayMs: 0,
      sleep: async () => {
        sleeps += 1;
      },
    });
    expect(result).toBe('a b c');
    expect(sleeps).toBe(0);
  });

  it('stops when aborted and reports only what was delivered', async () => {
    const controller = new AbortController();
    const seen: string[] = [];
    const result = await streamOfflineText('one two three four', {
      signal: controller.signal,
      onDelta: (piece) => {
        seen.push(piece);
        if (seen.length === 2) controller.abort();
      },
      sleep: async () => undefined,
    });
    expect(result).toBe('one two ');
    expect(seen).toEqual(['one ', 'two ']);
  });

  it('resolves immediately when already aborted', async () => {
    const controller = new AbortController();
    controller.abort();
    expect(await streamOfflineText('one two', { signal: controller.signal })).toBe('');
  });

  it('runOfflineCoach streams the same text respondOffline returns', async () => {
    const pieces: string[] = [];
    const answer = await runOfflineCoach({
      message: 'one easy win',
      context,
      wordDelayMs: 0,
      onDelta: (piece) => pieces.push(piece),
    });
    expect(pieces.join('')).toBe(answer.text);
    expect(answer.delivered).toBe(answer.text);
    expect(answer.text).toBe(respondOffline('one easy win', context).text);
    expect(answer.label).toBe(OFFLINE_LABEL);
  });

  it('never exposes a half-finished chip when parsed while streaming', async () => {
    const pieces: string[] = [];
    await runOfflineCoach({
      message: 'dinner',
      context,
      wordDelayMs: 0,
      onDelta: (p) => pieces.push(p),
    });
    let buffer = '';
    const ids = new Set(context.actions?.map((a) => a.id));
    for (const piece of pieces) {
      buffer += piece;
      const shown = parseCoachText(buffer, { actions: ids, streaming: true })
        .map((s) => (s.type === 'text' ? s.text : ''))
        .join('');
      expect(shown).not.toMatch(/\[/);
    }
  });
});
