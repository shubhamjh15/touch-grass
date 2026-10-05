/** XP to level. Levels are uncapped; titles describe the player, not the tree. */

/** Total XP needed for levels 1 to 30, shipped as a table so the published numbers cannot drift. */
export const LEVEL_TABLE = [
  0, 60, 210, 430, 730, 1090, 1510, 1990, 2530, 3130, 3790, 4490, 5260, 6070, 6940, 7850, 8820,
  9840, 10910, 12020, 13180, 14390, 15650, 16950, 18300, 19700, 21140, 22630, 24160, 25730,
] as const;

const TITLES = [
  [30, 'Grove Elder'],
  [25, 'Wildwood Warden'],
  [20, 'Forest Guardian'],
  [15, 'Canopy Keeper'],
  [10, 'Grove Tender'],
  [5, 'Sprout Scout'],
  [1, 'Seed Sower'],
] as const;

/** Total XP at which `level` begins. */
export function xpForLevel(level: number): number {
  const whole = Math.max(1, Math.floor(level));
  const fromTable = LEVEL_TABLE[whole - 1];
  if (fromTable !== undefined) return fromTable;
  return Math.round((60 * Math.pow(whole - 1, 1.8)) / 10) * 10;
}

/** The highest level whose threshold is at or below `xp`. */
export function levelOf(xp: number): number {
  const total = Math.max(0, xp);
  // The inverse of the curve gives a close guess; the loops settle the rounding.
  let level = Math.max(1, Math.floor(Math.pow(total / 60, 1 / 1.8)) + 1);
  while (level > 1 && xpForLevel(level) > total) level -= 1;
  while (xpForLevel(level + 1) <= total) level += 1;
  return level;
}

/** "Grove Elder ★" from level 40, one more star every ten levels. */
export function levelTitle(level: number): string {
  const whole = Math.max(1, Math.floor(level));
  const base = TITLES.find(([from]) => whole >= from)?.[1] ?? 'Seed Sower';
  const stars = whole >= 40 ? Math.floor((whole - 30) / 10) : 0;
  return stars > 0 ? `${base} ${'★'.repeat(stars)}` : base;
}

export interface LevelInfo {
  level: number;
  title: string;
  xp: number;
  /** Total XP at which this level began. */
  levelStartXp: number;
  /** Total XP at which the next level begins. */
  nextLevelXp: number;
  xpIntoLevel: number;
  xpToNext: number;
  /** 0..1 through the current level. */
  progress: number;
}

export function levelInfo(xp: number): LevelInfo {
  const total = Math.max(0, Math.floor(xp));
  const level = levelOf(total);
  const levelStartXp = xpForLevel(level);
  const nextLevelXp = xpForLevel(level + 1);
  const span = nextLevelXp - levelStartXp;
  return {
    level,
    title: levelTitle(level),
    xp: total,
    levelStartXp,
    nextLevelXp,
    xpIntoLevel: total - levelStartXp,
    xpToNext: nextLevelXp - total,
    progress: span > 0 ? (total - levelStartXp) / span : 0,
  };
}
