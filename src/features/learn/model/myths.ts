import { LESSON_BY_ID, MYTHS, type Lesson, type Myth, type MythVerdict } from '@/data/content';
import type { Hue } from '@/ui';
import { plainText } from './richText';

/** The rubber stamp on the back of a myth card. The verdict in words is always printed beside it. */
export interface VerdictStamp {
  label: string;
  hue: Hue;
}

export const VERDICT_STAMP: Readonly<Record<MythVerdict, VerdictStamp>> = {
  false: { label: 'Busted', hue: 'tomato' },
  'mostly-false': { label: 'Mostly busted', hue: 'pink' },
  misleading: { label: 'Misleading', hue: 'violet' },
  conditional: { label: 'It depends', hue: 'blue' },
};

/** One myth card as the deck shows it. */
export interface MythCardModel {
  myth: Myth;
  /** 1-based: the number the store remembers a first flip by. */
  number: number;
  /** Flipped at least once on this device. */
  checked: boolean;
  /** The lesson the back links to; `null` if it no longer exists. */
  lesson: Lesson | null;
  stamp: VerdictStamp;
}

/** The ten myths joined with which ones this device has already flipped. */
export function buildMythDeck(flipped: readonly number[]): MythCardModel[] {
  const seen = new Set(flipped);
  return MYTHS.map((myth, index) => ({
    myth,
    number: index + 1,
    checked: seen.has(index + 1),
    lesson: LESSON_BY_ID.get(myth.lessonId) ?? null,
    stamp: VERDICT_STAMP[myth.verdict],
  }));
}

/** "Nº 03": the album number printed on both faces. */
export function mythNumber(number: number): string {
  return `Nº ${String(number).padStart(2, '0')}`;
}

/** What a screen reader hears when a card turns over: the verdict, the why, and any XP. */
export function mythAnnouncement(
  myth: Pick<Myth, 'verdictLabel' | 'explanation'>,
  xp: number,
): string {
  const verdict = `${myth.verdictLabel} ${plainText(myth.explanation)}`;
  return xp > 0 ? `${verdict} Plus ${xp} XP.` : verdict;
}
