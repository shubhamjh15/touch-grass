'use client';

import { EllipsisVertical } from 'lucide-react';
import { Button } from '../Button';
import { Card } from '../Card';
import { TreeGlyph } from '../glyphs';
import { PageHeader, SectionHeading } from '../headings';
import { IconButton } from '../IconButton';
import { Prose } from '../misc';
import { PageContainer, Section } from '../PageContainer';
import { ProgressBar } from '../ProgressBar';
import { Chapter, Demo } from './parts';

const QUESTS = [
  { title: 'Log two actions', done: 1, of: 2, reward: '+40 XP' },
  { title: 'Read one lesson', done: 0, of: 1, reward: '+30 XP' },
  { title: 'Skip one car trip', done: 0, of: 1, reward: '+50 XP' },
] as const;

/** A whole screen in miniature: it shows what "one screen, one job" looks like with these parts. */
function ExampleScreen() {
  return (
    <div className="w-full max-w-[390px] overflow-hidden rounded-xl border-2 border-ink bg-mat">
      <PageContainer sections className="py-8">
        <div className="flex flex-col items-center text-center">
          <div className="grid h-56 w-full place-items-center rounded-lg bg-blue-tint text-green-deep">
            <TreeGlyph species="oak" size={120} />
          </div>
          <p className="mt-5 font-display text-h1">Fern</p>
          <p className="mt-1 text-body text-ink-2">Sapling · Day 12 · Thriving</p>
          <p className="mt-4 text-body">One more action closes today&apos;s ring.</p>
          <Button variant="primary" size="lg" fullWidth className="mt-5">
            Log an action
          </Button>
        </div>
        <Section title="Today's quests" meta="Resets in 9 h">
          <Card padded={false} className="divide-y divide-line">
            {QUESTS.map((quest) => (
              <div key={quest.title} className="flex items-center gap-4 px-5 py-4">
                <div className="min-w-0 flex-1">
                  <p className="text-body font-semibold">{quest.title}</p>
                  <ProgressBar
                    value={quest.done}
                    max={quest.of}
                    label={quest.title}
                    valueText={`${quest.done} of ${quest.of}`}
                    className="mt-2.5"
                  />
                </div>
                <p className="shrink-0 text-body-sm font-semibold text-ink-3">{quest.reward}</p>
              </div>
            ))}
          </Card>
        </Section>
        <p className="text-center">
          <Button variant="link">Take a Touch grass break</Button>
        </p>
      </PageContainer>
    </div>
  );
}

export function PageChapter() {
  return (
    <Chapter
      id="page"
      title="Pages"
      rule="One screen, one job: a headline of six words or fewer, one primary button, and nothing on top of the tree."
    >
      <Demo title="Page header" className="flex-col gap-y-8">
        <PageHeader
          title="Quests"
          lead="Small goals that reset each day and each week."
          className="w-full max-w-xl"
        />
        <PageHeader
          title="Why food miles mislead"
          back={{ label: 'Learn', href: '#page' }}
          action={
            <IconButton
              label="Lesson options"
              icon={EllipsisVertical}
              variant="ghost"
              tooltipSide={null}
            />
          }
          className="w-full max-w-xl"
        />
      </Demo>

      <Demo
        title="Section heading"
        note="A title with one quiet line or one link on the right."
        className="flex-col"
      >
        <div className="w-full max-w-xl">
          <SectionHeading title="This week" meta="Ends on Sunday" />
          <SectionHeading title="Badges" action={{ label: 'See all', href: '#surfaces' }} />
        </div>
      </Demo>

      <Demo
        title="An example screen"
        note="390 px wide. The tree alone at the top, its name and one status line under it, one button, three rows, one quiet link."
      >
        <ExampleScreen />
      </Demo>

      <Demo title="Reading" note="Lessons, methodology and privacy: one column, 640 px at most.">
        <Prose>
          <h2>How we count</h2>
          <p>
            Every figure in the app is an <strong>estimate</strong>. We multiply what you did by a
            published factor and compare it with the usual alternative.
          </p>
          <ul>
            <li>Each estimate shows its formula and its likely range.</li>
            <li>When we cannot estimate something honestly, we say so.</li>
          </ul>
          <blockquote>
            <p>A short trip by bike instead of by car is one of the simplest swaps there is.</p>
          </blockquote>
        </Prose>
      </Demo>
    </Chapter>
  );
}
