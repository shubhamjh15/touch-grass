import { describe, expect, it } from 'vitest';
import { chipHref, chipKey, parseCoachText, stripChips, type CoachSegment } from './chips';

const actions = ['eat_veg_meal', 'move_bike_trip', 'power_heat_down'];
const base = { actions };

const text = (value: string): CoachSegment => ({ type: 'text', text: value });

describe('parseCoachText: protocol', () => {
  it('splits text and a log chip', () => {
    expect(parseCoachText('Try a veggie dinner.\n[[log:eat_veg_meal]]', base)).toEqual([
      text('Try a veggie dinner.'),
      { type: 'chip', kind: 'log', actionId: 'eat_veg_meal', quantity: null },
    ]);
  });

  it('reads a quantity', () => {
    expect(parseCoachText('Ride.\n[[log:move_bike_trip?qty=5]]', base)[1]).toEqual({
      type: 'chip',
      kind: 'log',
      actionId: 'move_bike_trip',
      quantity: 5,
    });
    expect(parseCoachText('[[log:move_bike_trip?qty=2.5]]', base)[0]).toMatchObject({
      quantity: 2.5,
    });
  });

  it('drops chips whose action id is unknown, silently', () => {
    expect(parseCoachText('Hi.\n[[log:made_up]]', base)).toEqual([text('Hi.')]);
    expect(parseCoachText('Hi.\n[[log:eat_veg_meal]]')).toEqual([text('Hi.')]);
  });

  it('drops malformed tokens and out-of-range quantities', () => {
    for (const token of [
      '[[log:eat_veg_meal?qty=0]]',
      '[[log:eat_veg_meal?qty=-3]]',
      '[[log:eat_veg_meal?qty=abc]]',
      '[[log:eat_veg_meal?x=1]]',
      '[[log:]]',
      '[[LOG:eat_veg_meal]]',
      '[[log:eat veg meal]]',
      '[[break:0]]',
      '[[break:61]]',
      '[[break:ten]]',
    ]) {
      expect(parseCoachText(`Text ${token}`, base)).toEqual([text('Text')]);
    }
  });

  it('applies a per-action quantity limit', () => {
    const quantityLimit = (id: string): number | undefined =>
      id === 'move_bike_trip' ? 150 : undefined;
    expect(parseCoachText('[[log:move_bike_trip?qty=151]]', { ...base, quantityLimit })).toEqual(
      [],
    );
    expect(
      parseCoachText('[[log:move_bike_trip?qty=150]]', { ...base, quantityLimit }),
    ).toHaveLength(1);
  });

  it('parses learn, break and quest chips, validated against lists when given', () => {
    const options = { ...base, lessonSlugs: ['the-blanket'], questIds: ['d_plant_day'] };
    expect(
      parseCoachText(
        'Read, rest, finish.\n[[learn:the-blanket]]\n[[break:10]]\n[[quest:d_plant_day]]',
        options,
      ),
    ).toEqual([
      text('Read, rest, finish.'),
      { type: 'chip', kind: 'learn', slug: 'the-blanket' },
      { type: 'chip', kind: 'break', minutes: 10 },
      { type: 'chip', kind: 'quest', questId: 'd_plant_day' },
    ]);
    expect(parseCoachText('[[learn:unknown]] [[quest:nope]]', options)).toEqual([]);
    expect(parseCoachText('[[learn:anything]]', base)).toHaveLength(1);
  });

  it('keeps at most three chips and removes duplicates', () => {
    const many =
      '[[log:eat_veg_meal]][[log:eat_veg_meal]][[log:move_bike_trip]][[log:power_heat_down]][[break:5]]';
    const chips = parseCoachText(many, base).filter((s) => s.type === 'chip');
    expect(chips).toHaveLength(3);
    expect(new Set(chips.map((c) => chipKey(c))).size).toBe(3);
  });

  it('keeps ordinary brackets, markdown links and double brackets that are not chips', () => {
    const md = 'See [the guide](/learn/the-blanket) and [1] for more.';
    expect(parseCoachText(md, base)).toEqual([text(md)]);
    expect(parseCoachText('Use [[wiki links]] sparingly.', base)).toEqual([
      text('Use [[wiki links]] sparingly.'),
    ]);
  });

  it('treats a very long unfinished [[ as plain text rather than hiding the answer', () => {
    const long = `Start [[${'x'.repeat(200)} and the answer goes on`;
    const segments = parseCoachText(long, { ...base, streaming: true });
    expect(segments.map((s) => (s.type === 'text' ? s.text : '')).join('')).toContain(
      'and the answer goes on',
    );
  });

  it('puts inline chips between text pieces without leaving stray spaces', () => {
    expect(parseCoachText('Do this [[log:eat_veg_meal]] today.', base)).toEqual([
      text('Do this'),
      { type: 'chip', kind: 'log', actionId: 'eat_veg_meal', quantity: null },
      text('today.'),
    ]);
  });
});

describe('parseCoachText: streaming', () => {
  const full =
    'Easiest win: a veggie dinner.\n[[log:eat_veg_meal]]\n[[log:move_bike_trip?qty=5]]\n[[break:10]]';
  const visible = (segments: CoachSegment[]): string =>
    segments.map((s) => (s.type === 'text' ? s.text : '')).join('');

  it('never shows half a token, whatever the prefix of the message is', () => {
    for (let end = 0; end <= full.length; end += 1) {
      const shown = visible(parseCoachText(full.slice(0, end), { ...base, streaming: true }));
      expect(shown).not.toMatch(/\[/);
      expect(shown).not.toMatch(/log:|break:/);
    }
  });

  it('only ever grows: text and chips never disappear as more arrives', () => {
    let previousText = '';
    let previousChips = 0;
    for (let end = 0; end <= full.length; end += 1) {
      const segments = parseCoachText(full.slice(0, end), { ...base, streaming: true });
      const shown = visible(segments).trimEnd();
      expect(shown.startsWith(previousText.trimEnd())).toBe(true);
      const chips = segments.filter((s) => s.type === 'chip').length;
      expect(chips).toBeGreaterThanOrEqual(previousChips);
      previousText = shown;
      previousChips = chips;
    }
    expect(previousChips).toBe(3);
  });

  it('gives the same result as one-shot parsing once the stream is complete', () => {
    expect(parseCoachText(full, { ...base, streaming: true })).toEqual(parseCoachText(full, base));
  });

  it('hides a trailing single bracket that may become [[ but keeps it once final', () => {
    expect(visible(parseCoachText('Try this [', { ...base, streaming: true }))).toBe('Try this');
    expect(visible(parseCoachText('Try this [', base))).toBe('Try this [');
  });

  it('works for chunks split at every position, fed as growing buffers', () => {
    const chunks = ['Try a bik', 'e ride.\n[', '[log:move_', 'bike_trip?q', 'ty=5]', ']'];
    let buffer = '';
    for (const chunk of chunks) {
      buffer += chunk;
      expect(visible(parseCoachText(buffer, { ...base, streaming: true }))).not.toMatch(/\[|log:/);
    }
    expect(parseCoachText(buffer, { ...base, streaming: true }).at(-1)).toMatchObject({
      kind: 'log',
      actionId: 'move_bike_trip',
      quantity: 5,
    });
  });

  it('drops an unterminated chip attempt once the message is final', () => {
    expect(parseCoachText('Hello [[log:eat_veg', base)).toEqual([text('Hello')]);
  });
});

describe('helpers', () => {
  it('stripChips removes every token', () => {
    expect(stripChips('Hello.\n[[log:eat_veg_meal]] [[break:10]]')).toBe('Hello.');
  });

  it('chipHref builds the shared deep links', () => {
    expect(chipHref({ type: 'chip', kind: 'log', actionId: 'move_bike_trip', quantity: 5 })).toBe(
      '/log?a=move_bike_trip&src=coach&q=5',
    );
    expect(chipHref({ type: 'chip', kind: 'log', actionId: 'eat_veg_meal', quantity: null })).toBe(
      '/log?a=eat_veg_meal&src=coach',
    );
    expect(chipHref({ type: 'chip', kind: 'learn', slug: 'the-blanket' })).toBe(
      '/learn/the-blanket',
    );
  });
});
