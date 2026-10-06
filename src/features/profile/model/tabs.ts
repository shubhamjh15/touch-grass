/**
 * The four index tabs of `/me` and the ways a link can name one: `?tab=settings`, or the anchors
 * the rest of the app already uses (`/me#data` from the command palette, `/me#starting-line` from
 * Impact's pace card).
 */
export const TABS = ['badges', 'island', 'settings', 'data'] as const;
export type ProfileTab = (typeof TABS)[number];

export const TAB_PARAM = 'tab';
export const DEFAULT_TAB: ProfileTab = 'badges';

/** Where a link wants to land: a tab and, inside it, an element to scroll to. */
export interface ProfileTarget {
  tab: ProfileTab;
  anchor: string | null;
}

export function isProfileTab(value: unknown): value is ProfileTab {
  return typeof value === 'string' && (TABS as readonly string[]).includes(value);
}

export function parseTab(value: string | null | undefined): ProfileTab {
  return isProfileTab(value) ? value : DEFAULT_TAB;
}

const HASHES: Readonly<Record<string, ProfileTarget>> = {
  badges: { tab: 'badges', anchor: null },
  island: { tab: 'island', anchor: null },
  'island-log': { tab: 'island', anchor: null },
  settings: { tab: 'settings', anchor: null },
  'starting-line': { tab: 'settings', anchor: 'starting-line' },
  data: { tab: 'data', anchor: null },
  export: { tab: 'data', anchor: null },
  import: { tab: 'data', anchor: null },
  reset: { tab: 'data', anchor: 'reset' },
};

/** `#data` to the Data tab; `null` for anything this page does not know. */
export function targetFromHash(hash: string): ProfileTarget | null {
  const key = hash.replace(/^#/, '').toLowerCase();
  return HASHES[key] ?? null;
}

/** The address of a tab, keeping the other query parameters and dropping any anchor. */
export function tabHref(tab: ProfileTab, search: string): string {
  const params = new URLSearchParams(search);
  if (tab === DEFAULT_TAB) params.delete(TAB_PARAM);
  else params.set(TAB_PARAM, tab);
  const query = params.toString();
  return query ? `/me?${query}` : '/me';
}
