'use client';

import { Lock } from 'lucide-react';
import { useRef, useState } from 'react';
import { PageHeader, PageSection, PageStack } from '@/app/shell';
import { useChallenge, useJournal, useToday } from '@/game';
import { OfflineBanner, StickerPill, TabPanel, Tabs, Tag, type TabItem } from '@/ui';
import { ChallengePanel } from './components/ChallengePanel';
import { Composer } from './components/Composer';
import { JournalList } from './components/JournalList';
import { LinkCard } from './components/LinkCard';
import { ShareStudio } from './components/ShareStudio';
import { TeamNotes } from './components/TeamNotes';
import { COMMUNITY_COPY } from './copy';
import { EMPTY_DRAFT, type Draft } from './model/draft';
import { readLink, useLocationHash } from './model/linkHash';
import { promptOfTheWeek } from './model/prompts';

type TabId = 'journal' | 'share' | 'challenge' | 'team';

const COPY = COMMUNITY_COPY;

/**
 * `/community`, in local mode: a private journal, a short shelf of notes from the team, a share card
 * of your tree and stateless challenge links. Nothing here pretends other people are present.
 */
export default function CommunityPage() {
  const notes = useJournal();
  const today = useToday();
  const challenge = useChallenge();
  const hash = useLocationHash();
  const link = readLink(hash, today.day);

  // A visitor who arrived by a link wants the challenge first; everyone else wants the journal.
  const [tab, setTab] = useState<TabId>(() => (link.kind === 'none' ? 'journal' : 'challenge'));
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const textarea = useRef<HTMLTextAreaElement | null>(null);

  const tabs: TabItem<TabId>[] = [
    { value: 'journal', label: COPY.tabs.journal, count: notes.length },
    { value: 'share', label: COPY.tabs.share },
    { value: 'challenge', label: COPY.tabs.challenge, count: challenge ? 1 : undefined },
    { value: 'team', label: COPY.tabs.team },
  ];

  const writeNote = () => {
    textarea.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    textarea.current?.focus({ preventScroll: true });
  };

  return (
    <div className="@container">
      <PageHeader slug={COPY.slug} title={COPY.title} lead={COPY.lead} fill="pink">
        <div className="flex flex-wrap items-center gap-3">
          <StickerPill hue="yellow" icon={Lock} rotate={-2}>
            {COPY.localSticker}
          </StickerPill>
          <OfflineBanner />
        </div>
      </PageHeader>

      <PageStack>
        {link.kind !== 'none' ? (
          <LinkCard
            view={link}
            onAccepted={() => setTab('challenge')}
            onStartOwn={() => setTab('challenge')}
          />
        ) : null}

        <Tabs value={tab} onValueChange={setTab} tabs={tabs} aria-label={COPY.tabsLabel}>
          <TabPanel value="journal" bare className="grid gap-8">
            <Composer
              prompt={promptOfTheWeek(today.day)}
              draft={draft}
              onDraftChange={setDraft}
              textareaRef={textarea}
            />
            <PageSection
              title={COPY.journal.title}
              lead={COPY.journal.lead}
              aside={
                <Tag icon={Lock} hue="paper">
                  {COPY.journal.privateTag}
                </Tag>
              }
            >
              <JournalList notes={notes} today={today.day} onWrite={writeNote} />
            </PageSection>
          </TabPanel>

          <TabPanel value="share" bare>
            <PageSection title={COPY.share.title} lead={COPY.share.lead}>
              <ShareStudio />
            </PageSection>
          </TabPanel>

          <TabPanel value="challenge" bare>
            <ChallengePanel today={today.day} />
          </TabPanel>

          <TabPanel value="team" bare>
            <PageSection title={COPY.team.title} lead={COPY.team.lead}>
              <TeamNotes />
            </PageSection>
          </TabPanel>
        </Tabs>
      </PageStack>
    </div>
  );
}
