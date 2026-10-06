import { Sprout, Target, Thermometer, type LucideIcon } from 'lucide-react';
import { LESSON_CATEGORIES, type LessonCategoryId } from '@/data/content';
import { CATEGORY, CATEGORY_ICON, FILL_BG, TINT_BG } from '@/ui';

/**
 * How a lesson topic is printed. Five topics are product categories and wear that category's
 * colours; "Climate", "Action" and "Hope" are editorial topics with their own. A topic is always
 * icon + word + colour, never colour alone.
 */
export interface TopicStyle {
  id: LessonCategoryId;
  label: string;
  icon: LucideIcon;
  /** Fill of the printed tag; carries its own text colour. */
  tag: string;
  /** Tint behind the topic icon on a lesson card. */
  tile: string;
}

const STYLE: Record<LessonCategoryId, Omit<TopicStyle, 'id' | 'label'>> = {
  climate: { icon: Thermometer, tag: FILL_BG.blue, tile: TINT_BG.blue },
  action: { icon: Target, tag: FILL_BG.ink, tile: 'bg-paper' },
  eat: { icon: CATEGORY_ICON.eat, tag: CATEGORY.eat.bg, tile: CATEGORY.eat.tintBg },
  move: { icon: CATEGORY_ICON.move, tag: CATEGORY.move.bg, tile: CATEGORY.move.tintBg },
  power: { icon: CATEGORY_ICON.power, tag: CATEGORY.power.bg, tile: CATEGORY.power.tintBg },
  stuff: { icon: CATEGORY_ICON.stuff, tag: CATEGORY.stuff.bg, tile: CATEGORY.stuff.tintBg },
  waste: { icon: CATEGORY_ICON.waste, tag: CATEGORY.waste.bg, tile: CATEGORY.waste.tintBg },
  hope: { icon: Sprout, tag: FILL_BG.green, tile: TINT_BG.green },
};

/** The topics in the order the filter shows them. */
export const TOPICS: readonly TopicStyle[] = LESSON_CATEGORIES.map((category) => ({
  id: category.id,
  label: category.label,
  ...STYLE[category.id],
}));

export const TOPIC_BY_ID: Readonly<Record<LessonCategoryId, TopicStyle>> = Object.fromEntries(
  TOPICS.map((topic) => [topic.id, topic]),
) as Record<LessonCategoryId, TopicStyle>;
