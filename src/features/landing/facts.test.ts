import { describe, expect, it } from 'vitest';
import { ACTIONS, ACTION_BY_ID, CATEGORIES, DEFAULT_REGION, SOURCES } from '@/data/catalogue';
import { MYTHS } from '@/data/myths';
import { DAILY_QUEST_BY_ID } from '@/data/quests';
import { estimateKg, type KgContext } from '@/game';
import {
  ACTION_COUNT,
  CATEGORY_COUNT,
  DEMO_CONTEXT,
  ESTIMATE_FACTS,
  MYTH_COUNT,
  MYTH_FACT,
  QUEST_FACTS,
} from './facts';

// The page's copies must be the real thing. When one of these fails, the data changed:
// copy the value from the failure into facts.ts.
describe('landing facts', () => {
  it('assume what the app assumes before onboarding', () => {
    const context: KgContext = DEMO_CONTEXT;
    expect(context).toEqual({ region: DEFAULT_REGION, heat: 'unknown' });
  });

  it('count what exists', () => {
    expect(ACTION_COUNT).toBe(ACTIONS.length);
    expect(CATEGORY_COUNT).toBe(CATEGORIES.length);
    expect(MYTH_COUNT).toBe(MYTHS.length);
  });

  it('quote each estimate exactly as the factor engine computes it', () => {
    expect(ESTIMATE_FACTS.length).toBeGreaterThan(0);
    for (const fact of ESTIMATE_FACTS) {
      const name = `${fact.actionId} × ${fact.qty}`;
      const action = ACTION_BY_ID.get(fact.actionId);
      expect(action, name).toBeDefined();
      if (!action) continue;
      const estimate = estimateKg(action, fact.qty, DEMO_CONTEXT);
      expect(estimate, name).not.toBeNull();
      if (!estimate) continue;
      expect(fact.kg, name).toBeCloseTo(estimate.kg, 6);
      expect(fact.perUnit, name).toBeCloseTo(estimate.perUnit, 6);
      expect(fact.low, name).toBeCloseTo(estimate.low, 6);
      expect(fact.high, name).toBeCloseTo(estimate.high, 6);

      const source = action.sources.map((key) => SOURCES[key]).find(Boolean);
      expect(
        {
          unit: fact.unit,
          xp: fact.xp,
          counterfactual: fact.counterfactual,
          regional: fact.regional,
          sourceLabel: fact.sourceLabel,
          sourceYear: fact.sourceYear,
        },
        name,
      ).toEqual({
        unit: action.unit,
        xp: action.xp,
        counterfactual: action.counterfactual,
        regional: action.factor !== null && action.factor.regionalisation !== 'none',
        sourceLabel: source ? (source.publisher ?? source.title) : null,
        sourceYear: source?.year ?? null,
      });
    }
  });

  it('show two quests as the quest pool writes them', () => {
    for (const fact of Object.values(QUEST_FACTS)) {
      const quest = DAILY_QUEST_BY_ID.get(fact.id);
      expect(quest, fact.id).toBeDefined();
      expect(fact).toEqual({
        id: fact.id,
        title: quest?.title,
        copy: quest?.copy,
        pool: quest?.pool,
        xp: quest?.xp,
      });
    }
  });

  it('flip a myth that is in the lessons, with its first source', () => {
    const myth = MYTHS.find((entry) => entry.id === MYTH_FACT.id);
    expect(myth).toBeDefined();
    const source = myth?.sources[0];
    expect(MYTH_FACT).toEqual({
      id: myth?.id,
      verdictLabel: myth?.verdictLabel,
      myth: myth?.myth,
      explanation: myth?.explanation,
      source: { publisher: source?.publisher, year: source?.year },
    });
  });
});
