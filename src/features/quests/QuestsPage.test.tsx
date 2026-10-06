import { readFileSync } from 'node:fs';
import path from 'node:path';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DAILY_QUEST_BY_ID, EPICS, WEEKLY_QUEST_BY_ID } from '@/data/quests';
import { STORAGE_KEYS, drawDaily, drawWeekly, game, gameActions, getGameState } from '@/game';
import { resetSfx } from '@/lib/sfx';
import { installPointerCapture } from '@/ui/testUtils';
import { HOLD_MS } from './HoldButton';
import QuestsPage from './QuestsPage';
import { ChipList } from './QuestTicket';

// A tiny stand-in for the router: `replace` changes the query string and re-renders readers.
const nav = vi.hoisted(() => {
  let search = '';
  const listeners = new Set<() => void>();
  return {
    read: () => search,
    set(next: string) {
      search = next;
      for (const listener of [...listeners]) listener();
    },
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    replace: vi.fn(),
  };
});

vi.mock('next/navigation', async () => {
  const React = await import('react');
  const router = {
    replace: (href: string) => {
      nav.replace(href);
      nav.set(href.split('?')[1] ?? '');
    },
    push: vi.fn(),
  };
  return {
    useRouter: () => router,
    usePathname: () => '/quests',
    useSearchParams: () => {
      const search = React.useSyncExternalStore(nav.subscribe, nav.read, nav.read);
      return React.useMemo(() => new URLSearchParams(search), [search]);
    },
  };
});

// The Grove is a WebGL canvas; the page only needs the box it reserves.
vi.mock('@/world', () => ({
  WorldStage: ({ label }: { label?: string }) => <div role="img" aria-label={label} />,
  getStickingPoint: () => null,
}));

type Fixture = Record<string, { state: ReturnType<typeof getGameState>; version: number }>;

function loadFixture(name: string): Fixture {
  const file = path.resolve('scripts/fixtures', `${name}.json`);
  return JSON.parse(readFileSync(file, 'utf8')) as Fixture;
}

/** Fixtures are anchored to this morning: "day12" is the twelfth day at 10:30. */
const at = (hour: number, minute = 0, second = 0, day = 6) =>
  new Date(2026, 9, day, hour, minute, second).getTime();

let now = at(10, 31);

/** Puts a saved game on the device, exactly as the screenshot fixtures do, and loads it. */
function seed(name: string, patch?: (state: ReturnType<typeof getGameState>) => void): void {
  const fixture = loadFixture(name);
  const saved = fixture[STORAGE_KEYS.game];
  if (!saved) throw new Error(`fixture ${name} has no saved game`);
  patch?.(saved.state);
  localStorage.setItem(STORAGE_KEYS.game, JSON.stringify(saved));
  game.rehydrate();
  gameActions.tick();
}

const xp = () => getGameState().xp;
const ticket = (title: string) => {
  const item = screen.getByRole('heading', { name: new RegExp(`^${title}`) }).closest('li');
  if (!item) throw new Error(`no ticket for ${title}`);
  return item;
};

beforeEach(() => {
  now = at(10, 31);
  nav.set('');
  nav.replace.mockClear();
  game.setClock(() => now);
  installPointerCapture();
  resetSfx();
});

afterEach(() => {
  vi.useRealTimers();
  game.setClock(() => Date.now());
  gameActions.resetAll();
});

describe('daily and weekly boards', () => {
  it('shows each daily with its copy, progress, reward and time left', () => {
    seed('day12');
    render(<QuestsPage />);

    expect(screen.getByRole('heading', { level: 1, name: 'Quests' })).toBeInTheDocument();
    const state = getGameState();
    for (const id of state.quests.daily?.slots ?? []) {
      const quest = DAILY_QUEST_BY_ID.get(id);
      if (!quest) throw new Error(`unknown quest ${id}`);
      const item = within(ticket(quest.title));
      expect(item.getByText(quest.copy)).toBeInTheDocument();
      expect(item.getByRole('meter', { name: `${quest.title} progress` })).toBeInTheDocument();
      expect(item.getByText(/^\d+ \/ \d+$/)).toBeInTheDocument();
      expect(item.getAllByText(new RegExp(`\\+${quest.xp}`)).length).toBeGreaterThan(0);
      expect(item.getByText('13 h left')).toBeInTheDocument();
    }
    expect(screen.getByText('Resets in 13 h 29 min')).toBeInTheDocument();
  });

  it('draws the same quests for the same date, seed and focus', () => {
    seed('day12');
    render(<QuestsPage />);
    const { profile, settings, quests } = getGameState();
    const input = {
      userSeed: profile.userSeed,
      focus: profile.focus,
      hidden: new Set(settings.hiddenActions),
    };
    expect(quests.daily?.slots).toEqual(drawDaily('2026-10-06', input));
    expect(quests.weekly?.slots).toEqual(drawWeekly('2026-10-06', input));
    expect(drawDaily('2026-10-06', input)).toEqual(drawDaily('2026-10-06', { ...input }));
    for (const id of drawDaily('2026-10-06', input)) {
      expect(
        screen.getByRole('heading', { name: DAILY_QUEST_BY_ID.get(id)?.title }),
      ).toBeInTheDocument();
    }
  });

  it('claims a finished quest exactly once when its stub is torn off', async () => {
    const user = userEvent.setup();
    seed('day1', (state) => {
      if (state.quests.daily)
        state.quests.daily.slots = ['d_double_up', 'd_muscle_power', 'd_brain_food'];
    });
    render(<QuestsPage />);
    expect(screen.queryByRole('button', { name: /^Claim/ })).not.toBeInTheDocument();

    act(() => {
      gameActions.logAction({ actionId: 'plant-based-meal', qty: 2 });
    });
    const before = xp();
    const stub = screen.getByRole('button', { name: 'Claim +15 XP for Double up' });
    await user.click(stub);

    expect(xp()).toBe(before + 15);
    expect(screen.queryByRole('button', { name: /^Claim/ })).not.toBeInTheDocument();
    expect(within(ticket('Double up')).getByText('Claimed. Plus 15 XP.')).toBeInTheDocument();
    expect(within(ticket('Double up')).getByText('Claimed · +15 XP')).toBeInTheDocument();

    // A second claim, from anywhere, is a no-op.
    expect(gameActions.claimQuest('d_double_up')).toEqual({ ok: false, reason: 'already-claimed' });
    expect(xp()).toBe(before + 15);
    expect(
      getGameState().quests.claims.filter((claim) => claim.questId === 'd_double_up'),
    ).toHaveLength(1);
  });

  it('tears the stub from the keyboard and keeps focus on the ticket', async () => {
    const user = userEvent.setup();
    seed('day1', (state) => {
      if (state.quests.daily)
        state.quests.daily.slots = ['d_double_up', 'd_muscle_power', 'd_brain_food'];
    });
    render(<QuestsPage />);
    act(() => {
      gameActions.logAction({ actionId: 'plant-based-meal', qty: 2 });
    });
    const before = xp();
    screen.getByRole('button', { name: 'Claim +15 XP for Double up' }).focus();
    await user.keyboard('{Enter}');

    expect(xp()).toBe(before + 15);
    expect(ticket('Double up')).toHaveFocus();
  });

  it('follows the log: progress moves and an undone log takes the claim button away', () => {
    seed('day1', (state) => {
      if (state.quests.daily)
        state.quests.daily.slots = ['d_double_up', 'd_muscle_power', 'd_brain_food'];
    });
    render(<QuestsPage />);
    expect(within(ticket('Double up')).getByText('0 / 2')).toBeInTheDocument();

    let logId = '';
    act(() => {
      const first = gameActions.logAction({ actionId: 'plant-based-meal', qty: 1 });
      const second = gameActions.logAction({ actionId: 'shorter-shower' });
      if (first.ok && second.ok) logId = second.log.id;
    });
    expect(screen.getByRole('button', { name: /Claim \+15 XP for Double up/ })).toBeInTheDocument();
    expect(screen.getByText('1 ready. Tear off its stub.')).toBeInTheDocument();

    act(() => {
      gameActions.undoLog(logId);
    });
    expect(screen.queryByRole('button', { name: /^Claim/ })).not.toBeInTheDocument();
    expect(within(ticket('Double up')).getByText('1 / 2')).toBeInTheDocument();
  });

  it('swaps one untouched daily a day and says what arrived', async () => {
    const user = userEvent.setup();
    seed('day1');
    render(<QuestsPage />);
    const before = getGameState().quests.daily?.slots ?? [];
    const swaps = screen.getAllByRole('button', { name: /^Swap this quest/ });
    expect(swaps.length).toBeGreaterThan(0);

    const target = swaps[0]?.closest('li');
    const slot = before.findIndex(
      (id) =>
        DAILY_QUEST_BY_ID.get(id)?.title ===
        within(target as HTMLElement).getByRole('heading').textContent,
    );
    await user.click(swaps[0] as HTMLElement);

    const after = getGameState().quests.daily?.slots ?? [];
    expect(after[slot]).not.toBe(before[slot]);
    expect(after.filter((_, index) => index !== slot)).toEqual(
      before.filter((_, index) => index !== slot),
    );
    const arrived = DAILY_QUEST_BY_ID.get(after[slot] ?? '')?.title ?? '';
    expect(screen.getByRole('heading', { name: arrived })).toBeInTheDocument();
    expect(screen.getByText(`Swapped. New quest: ${arrived}.`)).toBeInTheDocument();
    expect(ticket(arrived)).toHaveFocus();
    // One swap per day: no ticket offers another.
    expect(screen.queryByRole('button', { name: /^Swap this quest/ })).not.toBeInTheDocument();
    expect(screen.getByText(/Today's swap is used/)).toBeInTheDocument();
  });

  it('does not offer a swap on a quest that has progress', () => {
    seed('day1', (state) => {
      if (state.quests.daily)
        state.quests.daily.slots = ['d_double_up', 'd_muscle_power', 'd_brain_food'];
    });
    render(<QuestsPage />);
    act(() => {
      gameActions.logAction({ actionId: 'plant-based-meal', qty: 1 });
    });
    expect(
      within(ticket('Double up')).queryByRole('button', { name: /^Swap/ }),
    ).not.toBeInTheDocument();
    expect(
      within(ticket('Muscle-powered')).getByRole('button', { name: /^Swap/ }),
    ).toBeInTheDocument();
  });

  it('links the actions that count to a prefilled log', () => {
    seed('day1', (state) => {
      if (state.quests.daily)
        state.quests.daily.slots = ['d_double_up', 'd_muscle_power', 'd_brain_food'];
    });
    render(<QuestsPage />);
    const link = within(ticket('Muscle-powered')).getByRole('link', {
      name: 'Log: Walked or cycled instead of driving',
    });
    expect(link).toHaveAttribute('href', '/log?a=walk-cycle-instead-of-car&src=quest');
    expect(within(ticket('Brain food')).getByRole('link', { name: 'Open Learn' })).toHaveAttribute(
      'href',
      '/learn',
    );
  });

  it('keeps the open board in the URL and shows the weeklies with their days left', async () => {
    const user = userEvent.setup();
    seed('day12');
    render(<QuestsPage />);
    await user.click(screen.getByRole('tab', { name: /Weekly/ }));

    expect(nav.replace).toHaveBeenLastCalledWith('/quests?tab=weekly');
    expect(screen.getByRole('tab', { name: /Weekly/ })).toHaveAttribute('aria-selected', 'true');
    for (const id of getGameState().quests.weekly?.slots ?? []) {
      const quest = WEEKLY_QUEST_BY_ID.get(id);
      expect(within(ticket(quest?.title ?? '')).getByText('6 days left')).toBeInTheDocument();
    }
  });

  it('opens on the tab a deep link names', () => {
    nav.set('tab=weekly');
    seed('day12');
    render(<QuestsPage />);
    expect(screen.getByRole('tab', { name: /Weekly/ })).toHaveAttribute('aria-selected', 'true');
    expect(
      screen.getByRole('heading', { level: 2, name: "This week's three" }),
    ).toBeInTheDocument();
  });

  it('sums up what was claimed while the user was away', () => {
    seed('day45');
    render(<QuestsPage />);
    const settledToday = getGameState().quests.claims.filter(
      (claim) => claim.auto && claim.kind === 'daily' && claim.ts >= at(0),
    );
    expect(settledToday.length).toBeGreaterThan(0);
    const first = DAILY_QUEST_BY_ID.get(settledToday[0]?.questId ?? '');
    expect(
      screen.getByText(
        new RegExp(`^Claimed for you while you were away: ${first?.title}, \\+${first?.xp} XP`),
      ),
    ).toBeInTheDocument();
  });

  it('redraws a slot whose quest was retired by an update', () => {
    seed('day12', (state) => {
      if (state.quests.daily) state.quests.daily.slots[1] = 'd_retired_quest';
    });
    render(<QuestsPage />);
    const slots = getGameState().quests.daily?.slots ?? [];
    expect(slots).not.toContain('d_retired_quest');
    expect(slots.every((id) => DAILY_QUEST_BY_ID.has(id))).toBe(true);
    expect(new Set(slots).size).toBe(3);
    expect(
      screen.getAllByRole('listitem').filter((item) => item.hasAttribute('data-quest')),
    ).toHaveLength(3);
  });

  it('rotates the dailies at local midnight without a reload', () => {
    vi.useFakeTimers();
    vi.setSystemTime(at(23, 59, 50));
    game.setClock(() => Date.now());
    seed('day12');
    render(<QuestsPage />);
    expect(getGameState().quests.daily?.key).toBe('2026-10-06');
    expect(screen.getByText('Resets in 10 sec')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(12_000);
    });
    expect(getGameState().quests.daily?.key).toBe('2026-10-07');
    expect(screen.getByText(/^Resets in 23 h 59 min$/)).toBeInTheDocument();
    for (const id of getGameState().quests.daily?.slots ?? []) {
      expect(
        screen.getByRole('heading', { name: DAILY_QUEST_BY_ID.get(id)?.title }),
      ).toBeInTheDocument();
    }
  });

  it('celebrates a clean sweep and says when the next three arrive', async () => {
    const user = userEvent.setup();
    seed('day1', (state) => {
      if (state.quests.daily)
        state.quests.daily.slots = ['d_double_up', 'd_mix_it_up', 'd_plant_plate'];
    });
    render(<QuestsPage />);
    act(() => {
      gameActions.logAction({ actionId: 'plant-based-meal', qty: 1 });
      gameActions.logAction({ actionId: 'shorter-shower' });
    });
    expect(screen.getByText('3 ready. Tear off the stubs.')).toBeInTheDocument();
    for (const title of ['Double up', 'Mix it up', 'Plant plate']) {
      await user.click(screen.getByRole('button', { name: new RegExp(`for ${title}$`) }));
    }
    expect(screen.getByText('Clean sweep. All three torn off.')).toBeInTheDocument();
    expect(screen.getByText('+15 XP bonus banked.')).toBeInTheDocument();
    expect(screen.getByText('Three new ones at midnight.')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Daily/ })).toHaveTextContent('0');
  });

  it('offers to draw the board when there is none', () => {
    seed('day1', (state) => {
      state.onboarding.completedAt = null;
      state.quests.daily = null;
      state.quests.weekly = null;
    });
    render(<QuestsPage />);
    expect(screen.getByText('The board is blank.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Draw quests' })).toBeInTheDocument();
  });
});

describe('epics', () => {
  beforeEach(() => {
    nav.set('tab=epics');
  });

  const card = (title: string) => {
    const article = screen.getByRole('heading', { name: title }).closest('article');
    if (!article) throw new Error(`no epic card for ${title}`);
    return article;
  };

  it('lists all twelve, split by how they are tracked', () => {
    seed('day12');
    render(<QuestsPage />);
    for (const epic of EPICS) {
      expect(
        screen.getByRole('heading', { name: new RegExp(`^${epic.title}`) }),
      ).toBeInTheDocument();
    }
    expect(screen.getByRole('heading', { level: 3, name: 'On your word' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 3, name: 'From your logs' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Epics/ })).toHaveTextContent('12');
  });

  it('confirms a checklist epic by holding, once every job is ticked', async () => {
    const user = userEvent.setup();
    seed('day12');
    render(<QuestsPage />);
    const epic = within(card('Home energy check-up'));
    await user.click(epic.getByRole('button', { name: /^Open this epic/ }));

    const hold = epic.getByRole('button', { name: 'I actually did this' });
    expect(hold).toHaveAttribute('aria-disabled', 'true');
    for (const box of epic.getAllByRole('checkbox')) await user.click(box);
    expect(getGameState().quests.epics.e_energy_checkup?.checklist).toEqual([
      true,
      true,
      true,
      true,
      true,
    ]);
    expect(epic.getByRole('button', { name: 'I actually did this' })).not.toHaveAttribute(
      'aria-disabled',
    );

    vi.useFakeTimers({
      toFake: [
        'requestAnimationFrame',
        'cancelAnimationFrame',
        'performance',
        'setTimeout',
        'clearTimeout',
      ],
    });
    const before = xp();
    const button = epic.getByRole('button', { name: 'I actually did this' });

    // Letting go early claims nothing.
    fireEvent.pointerDown(button, { pointerType: 'touch' });
    act(() => {
      vi.advanceTimersByTime(HOLD_MS / 2);
    });
    fireEvent.pointerUp(button);
    expect(xp()).toBe(before);
    expect(epic.getByText(/Let go too soon/)).toBeInTheDocument();

    fireEvent.pointerDown(button, { pointerType: 'touch' });
    act(() => {
      vi.advanceTimersByTime(HOLD_MS + 100);
    });
    // A first epic can also earn a badge, whose XP is paid on top of the epic's own.
    expect(xp()).toBeGreaterThanOrEqual(before + 300);
    expect(getGameState().quests.epics.e_energy_checkup?.claimedTs).not.toBeNull();
    expect(
      within(card('Home energy check-up')).getByText('Claimed. Plus 300 XP.'),
    ).toBeInTheDocument();
    expect(card('Home energy check-up')).toHaveFocus();
  });

  it('confirms from the keyboard by holding Space', async () => {
    seed('day12');
    render(<QuestsPage />);
    const epic = within(card('Switch to green power'));
    fireEvent.click(epic.getByRole('button', { name: /^Open this epic/ }));
    vi.useFakeTimers({
      toFake: [
        'requestAnimationFrame',
        'cancelAnimationFrame',
        'performance',
        'setTimeout',
        'clearTimeout',
      ],
    });
    const before = xp();
    const button = epic.getByRole('button', { name: 'I actually did this' });

    fireEvent.keyDown(button, { key: ' ' });
    act(() => {
      vi.advanceTimersByTime(HOLD_MS + 100);
    });
    // A first epic can also earn a badge, whose XP is paid on top of the epic's own.
    expect(xp()).toBeGreaterThanOrEqual(before + 300);
  });

  it('offers a plain confirmation for anyone who cannot hold, and limits claims to one a week', async () => {
    const user = userEvent.setup();
    seed('day12');
    render(<QuestsPage />);
    const epic = within(card('Switch to green power'));
    await user.click(epic.getByRole('button', { name: /^Open this epic/ }));
    await user.type(
      epic.getByRole('textbox', { name: /A note to yourself/ }),
      'Moved to a wind tariff.',
    );
    const before = xp();
    await user.click(epic.getByRole('button', { name: 'Confirm without holding' }));
    const dialog = within(screen.getByRole('dialog', { name: 'You actually did this?' }));
    await user.click(dialog.getByRole('button', { name: 'Yes, I did' }));

    // A first epic can also earn a badge, whose XP is paid on top of the epic's own.
    expect(xp()).toBeGreaterThanOrEqual(before + 300);
    expect(getGameState().quests.epics.e_green_power).toMatchObject({
      note: 'Moved to a wind tariff.',
    });
    expect(
      within(card('Switch to green power')).getByText('Moved to a wind tariff.'),
    ).toBeInTheDocument();

    // The others now wait a week.
    expect(
      screen.getAllByText('Ready in 7 days. Big changes take a while; so do we.').length,
    ).toBeGreaterThan(0);
    const other = within(card('Bin audit'));
    await user.click(other.getByRole('button', { name: /^Open this epic/ }));
    // Whatever else it is waiting for, its confirm button is not live.
    expect(other.getByRole('button', { name: 'I actually did this' })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
    expect(gameActions.completeEpic('e_bin_audit', true)).toMatchObject({ ok: false });
  });

  it('keeps a typed note even when the card is left before it is confirmed', async () => {
    const user = userEvent.setup();
    seed('day12');
    const view = render(<QuestsPage />);
    const epic = within(card('Bin audit'));
    await user.click(epic.getByRole('button', { name: /^Open this epic/ }));
    await user.type(epic.getByRole('textbox', { name: /^Top item/ }), 'Coffee cups, a keep-cup');
    view.unmount();
    expect(getGameState().quests.epics.e_bin_audit?.note).toBe('Coffee cups, a keep-cup\n\n');
  });

  it('pins one epic to Today and unpins it again', async () => {
    const user = userEvent.setup();
    seed('day12');
    render(<QuestsPage />);
    await user.click(within(card('Bin audit')).getByRole('button', { name: 'Pin to Today' }));
    expect(getGameState().quests.pinnedEpic).toBe('e_bin_audit');
    expect(screen.getByText('Bin audit is pinned to Today.')).toBeInTheDocument();
    const unpin = within(card('Bin audit')).getByRole('button', { name: 'Unpin from Today' });
    expect(unpin).toHaveAttribute('aria-pressed', 'true');

    // Pinning another moves the pin: there is only one.
    await user.click(screen.getAllByRole('button', { name: /^Pin to Today/ })[0] as HTMLElement);
    expect(getGameState().quests.pinnedEpic).not.toBe('e_bin_audit');
    expect(screen.getAllByRole('button', { name: /^Unpin from Today/ })).toHaveLength(1);
  });

  it('tears off an automatic epic once the logs have earned it', async () => {
    const user = userEvent.setup();
    seed('day200');
    render(<QuestsPage />);
    const ready = getGameState();
    const claimable = screen.queryAllByRole('button', { name: /^Claim \+\d+ XP for / });
    if (claimable.length === 0) {
      // Nothing is waiting in this save: finished epics must then be listed as such.
      expect(Object.values(ready.quests.epics).some((epic) => epic.claimedTs !== null)).toBe(true);
      expect(screen.getByRole('heading', { level: 3, name: 'Finished' })).toBeInTheDocument();
      return;
    }
    const before = xp();
    await user.click(claimable[0] as HTMLElement);
    expect(xp()).toBeGreaterThan(before);
  });

  it('says so when every epic is finished', () => {
    seed('day200', (state) => {
      for (const epic of EPICS) {
        state.quests.epics[epic.id] = { checklist: [], note: '', claimedTs: at(9) - 86_400_000 };
      }
    });
    render(<QuestsPage />);
    expect(
      screen.getByText('Every epic finished. New ones arrive with updates.'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'I actually did this' })).not.toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Epics/ })).toHaveTextContent('0');
  });
});

describe('the actions that count', () => {
  const actions = ['a', 'b', 'c', 'd'].map((id) => ({
    id,
    label: `Action ${id}`,
    title: `Do ${id}`,
    category: 'eat' as const,
    href: `/log?action=${id}`,
  }));

  it('shows two and opens the rest on request', async () => {
    const user = userEvent.setup();
    render(<ChipList actions={actions} />);
    expect(screen.getAllByRole('link')).toHaveLength(2);

    await user.click(screen.getByRole('button', { name: '+2 more' }));
    expect(screen.getAllByRole('link')).toHaveLength(4);
    await user.click(screen.getByRole('button', { name: 'Show fewer' }));
    expect(screen.getAllByRole('link')).toHaveLength(2);
  });

  it('shows a short list as it is', () => {
    render(<ChipList actions={actions.slice(0, 2)} />);
    expect(screen.getAllByRole('link')).toHaveLength(2);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
