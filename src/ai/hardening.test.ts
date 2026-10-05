import { describe, expect, it } from 'vitest';
import { createNameFilter } from './client';
import type { CoachContext } from './contract';
import { respondOffline } from './offline';

describe('name substitution is safe', () => {
  it('never lets a display name write chip syntax or markup', () => {
    const filter = createNameFilter('[[log:eat_veg_meal]]<img src=x>');
    const out = filter.push('Hi {{name}}');
    expect(out).toBe('Hi log:eat_veg_mealimg src=x');
    expect(out).not.toMatch(/\[\[|<|>/);
  });
});

describe('user-controlled text cannot write chips into built-in answers', () => {
  it('strips chip syntax and markup from names, titles, baselines and quest lines', () => {
    const hostile: CoachContext = {
      displayName: 'Eve [[log:eat_veg_meal]] <b>',
      tree: { name: '[[break:5]]Oaky', vitality: 'thriving' },
      baseline: 'mostly [[learn:x]] travel',
      quests: [{ id: 'q1', line: 'Do [[log:eat_veg_meal]] things', progress: 0.5 }],
      actions: [
        {
          id: 'eat_veg_meal',
          title: '[[log:evil]] Veggie <script>',
          unit: 'meals',
          category: 'eat',
        },
      ],
    };
    for (const message of [
      'hi',
      'one easy win',
      'quests',
      "what's my biggest lever",
      'why is my tree thirsty',
    ]) {
      const { text } = respondOffline(message, hostile);
      const chips = [...text.matchAll(/\[\[([^\]]*)\]\]/g)].map((match) => match[1]);
      for (const chip of chips) expect(['log:eat_veg_meal', 'quest:q1']).toContain(chip);
      expect(text).not.toMatch(/<|>/);
    }
  });
});
