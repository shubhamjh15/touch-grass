'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { PageHeader } from '@/app/shell';
import { useBadges, useLevelInfo } from '@/game';
import { TabPanel, Tabs, type TabItem } from '@/ui';
import { BadgesPanel } from './components/BadgesPanel';
import { DataPanel } from './components/DataPanel';
import { IslandPanel } from './components/IslandPanel';
import { Passport } from './components/Passport';
import { SettingsPanel } from './components/SettingsPanel';
import { COPY } from './copy';
import {
  TAB_PARAM,
  isProfileTab,
  parseTab,
  tabHref,
  targetFromHash,
  type ProfileTab,
} from './model/tabs';

/** The tab a link named, from `?tab=` or the `#anchor` the rest of the app uses. */
function arrival(params: URLSearchParams): { tab: ProfileTab; anchor: string | null } {
  if (params.has(TAB_PARAM)) return { tab: parseTab(params.get(TAB_PARAM)), anchor: null };
  return targetFromHash(window.location.hash) ?? { tab: parseTab(null), anchor: null };
}

/**
 * `/me`: the tree's passport, then four index tabs. Badges is the album and the next step; the
 * Island log writes down what arrived; Settings holds every preference; Your data is export,
 * import and reset. Nothing here is hidden for good: it is only a tab away.
 */
export default function ProfilePage() {
  const router = useRouter();
  const params = useSearchParams();
  const board = useBadges();
  const level = useLevelInfo();

  const [landing] = useState(() => arrival(params));
  const [tab, setTab] = useState<ProfileTab>(landing.tab);

  const choose = useCallback(
    (next: ProfileTab) => {
      setTab(next);
      router.replace(tabHref(next, params.toString()), { scroll: false });
    },
    [params, router],
  );

  // A link to a section of this page while it is already open (`/me#data` from the palette).
  useEffect(() => {
    const onHash = () => {
      const target = targetFromHash(window.location.hash);
      if (target) setTab(target.tab);
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  // A `?tab=` change from outside, such as a link or the Back button.
  const wanted = params.get(TAB_PARAM);
  useEffect(() => {
    if (isProfileTab(wanted)) setTab(wanted);
  }, [wanted]);

  // An anchor inside a tab (`#starting-line`) is scrolled to once the tab has rendered.
  useEffect(() => {
    if (!landing.anchor) return;
    document.getElementById(landing.anchor)?.scrollIntoView({ block: 'start' });
  }, [landing.anchor]);

  const tabs: TabItem<ProfileTab>[] = [
    { value: 'badges', label: COPY.tabs.badges, count: board.badgesEarned },
    { value: 'island', label: COPY.tabs.island },
    { value: 'settings', label: COPY.tabs.settings },
    { value: 'data', label: COPY.tabs.data },
  ];

  return (
    <div className="w-full">
      <PageHeader slug={`${level.title} · LV ${level.level}`} title={COPY.title} lead={COPY.lead} />

      <div className="grid grid-cols-[minmax(0,1fr)] gap-8 lg:gap-10">
        <Passport />

        <Tabs value={tab} onValueChange={choose} tabs={tabs} aria-label={COPY.tabsLabel}>
          <TabPanel value="badges" bare className="pt-5">
            <BadgesPanel />
          </TabPanel>
          <TabPanel value="island" bare className="pt-5">
            <IslandPanel />
          </TabPanel>
          <TabPanel value="settings" bare className="pt-5">
            <SettingsPanel />
          </TabPanel>
          <TabPanel value="data" bare className="pt-5">
            <DataPanel />
          </TabPanel>
        </Tabs>
      </div>
    </div>
  );
}
