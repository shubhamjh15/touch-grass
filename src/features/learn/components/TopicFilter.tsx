'use client';

import { play } from '@/lib/sfx';
import { Chip } from '@/ui';
import { LEARN_COPY } from '../copy';
import type { TopicFilter as Topic } from '../model/library';
import { TOPICS } from '../model/topics';

export interface TopicFilterProps {
  value: Topic;
  counts: Readonly<Record<Topic, number>>;
  onChange: (topic: Topic) => void;
}

/**
 * The row of topic chips above the lessons. Chips filter what is shown; a topic with no lessons
 * is not offered. The row scrolls sideways on a phone and never wraps past two lines.
 */
export function TopicFilter({ value, counts, onChange }: TopicFilterProps) {
  const choose = (topic: Topic) => {
    if (topic === value) return;
    play('toggle');
    onChange(topic);
  };

  return (
    <div
      role="group"
      aria-label={LEARN_COPY.filterLabel}
      className="scroll-row gap-2 @4xl:flex-wrap"
    >
      <Chip selected={value === 'all'} count={counts.all} onSelectedChange={() => choose('all')}>
        {LEARN_COPY.filterAll}
      </Chip>
      {TOPICS.filter((topic) => counts[topic.id] > 0).map((topic) => (
        <Chip
          key={topic.id}
          icon={topic.icon}
          selected={value === topic.id}
          count={counts[topic.id]}
          // Pressing the selected topic again takes the filter off.
          onSelectedChange={(selected) => choose(selected ? topic.id : 'all')}
        >
          {topic.label}
        </Chip>
      ))}
    </div>
  );
}
