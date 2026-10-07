import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EDITORIAL_POSTS } from '@/data/editorial';
import {
  XP_JOURNAL_NOTE,
  decodeChallenge,
  encodeChallenge,
  encodeChallengeResult,
  game,
  gameActions,
  getGameState,
  parseChallengeHash,
} from '@/game';
import CommunityPage from './CommunityPage';
import { at, seed, xp } from './testHarness';

// The Grove is a WebGL canvas; the page only needs the box it reserves, and no picture of it.
vi.mock('@/world', () => ({
  WorldStage: ({ label }: { label?: string }) => <div role="img" aria-label={label} />,
  captureWorld: () => Promise.resolve(null),
  emitPulse: vi.fn(),
}));

let now = at(10, 31);

beforeEach(() => {
  now = at(10, 31);
  game.setClock(() => now);
  window.history.replaceState(null, '', '/community');
  // jsdom has no canvas: the share card takes its SVG path, which is the path under test here.
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
});

afterEach(() => {
  vi.restoreAllMocks();
  game.setClock(() => Date.now());
  gameActions.resetAll();
  window.history.replaceState(null, '', '/community');
});

const openTab = async (name: string) => {
  await userEvent.click(screen.getByRole('tab', { name: new RegExp(`^${name}`) }));
};

const writeNote = async (text: string) => {
  await userEvent.click(screen.getByLabelText('Your note'));
  await userEvent.paste(text);
  await userEvent.click(screen.getByRole('button', { name: 'Save note' }));
};

describe('the journal', () => {
  it('opens on the honest sentence, the prompt of the week and a first-note invitation', () => {
    seed('day1');
    render(<CommunityPage />);

    expect(screen.getByRole('heading', { level: 1, name: 'Community' })).toBeInTheDocument();
    expect(screen.getByText(/There are no other people in here yet/)).toBeInTheDocument();
    expect(screen.getByText('Prompt of the week:')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Write your first note' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save note' })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
  });

  it('saves a note, clears the field, shows it and pays the once-a-day XP', async () => {
    seed('day12');
    render(<CommunityPage />);
    const before = xp();
    const notesBefore = getGameState().journal.length;

    await writeNote('Took the stairs and it felt fine.');

    expect(getGameState().journal).toHaveLength(notesBefore + 1);
    expect(xp()).toBe(before + XP_JOURNAL_NOTE);
    expect(screen.getByText('Took the stairs and it felt fine.')).toBeInTheDocument();
    expect(screen.getByLabelText('Your note')).toHaveValue('');
  });

  it('tags a note, and the second note of the day pays nothing', async () => {
    seed('day12');
    render(<CommunityPage />);
    await userEvent.click(screen.getByRole('button', { name: 'Win' }));
    await writeNote('First note of the day, long enough to count.');
    const afterFirst = xp();
    await userEvent.click(screen.getByRole('button', { name: 'Idea' }));
    await writeNote('A second note, also long enough to count.');

    const notes = getGameState().journal;
    expect(notes.at(-2)?.tag).toBe('win');
    expect(notes.at(-1)?.tag).toBe('idea');
    expect(xp()).toBe(afterFirst);
  });

  it('attaches a line about today only when something was logged', async () => {
    seed('day1');
    render(<CommunityPage />);
    expect(screen.getByRole('switch', { name: /Attach today/ })).toBeDisabled();
    expect(screen.getByText(/Nothing logged today yet/)).toBeInTheDocument();
  });

  it('keeps a half-written note when the visitor switches tabs and comes back', async () => {
    seed('day12');
    render(<CommunityPage />);
    await userEvent.click(screen.getByLabelText('Your note'));
    await userEvent.paste('Still thinking');
    await openTab('Share card');
    await openTab('Journal');
    expect(screen.getByLabelText('Your note')).toHaveValue('Still thinking');
  });

  it('searches and filters the notes, and says so when nothing matches', async () => {
    seed('day200');
    render(<CommunityPage />);
    const search = screen.getByRole('searchbox');

    await userEvent.type(search, 'chickpea');
    const found = screen.getAllByRole('article');
    expect(found.length).toBeLessThan(getGameState().journal.length);
    for (const card of found) expect(card).toHaveTextContent(/chickpea/i);

    await userEvent.clear(search);
    await userEvent.type(search, 'zzzz nothing');
    expect(screen.getByRole('heading', { name: 'No note matches that.' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(screen.getAllByRole('article').length).toBeGreaterThan(1);
  });

  it('shows six notes at a time and the rest on request', async () => {
    seed('day200');
    render(<CommunityPage />);
    expect(screen.getAllByRole('article')).toHaveLength(6);
    await userEvent.click(screen.getByRole('button', { name: /^Show \d+ more$/ }));
    expect(screen.getAllByRole('article').length).toBeGreaterThan(6);
  });

  it('edits a note in place and marks it edited', async () => {
    seed('day200');
    render(<CommunityPage />);
    const note = [...getGameState().journal].sort((a, b) => b.ts - a.ts)[0];
    await userEvent.click(screen.getByRole('searchbox'));
    await userEvent.paste(note?.text ?? '');
    const card = screen.getAllByRole('article')[0] as HTMLElement;
    await userEvent.click(within(card).getByRole('button', { name: 'Edit note' }));
    const field = within(card).getByLabelText('Edit your note');
    await userEvent.clear(field);
    await userEvent.paste('Changed my mind');
    await userEvent.click(within(card).getByRole('button', { name: 'Save changes' }));

    const edited = getGameState().journal.find((entry) => entry.id === note?.id);
    expect(edited?.text).toBe('Changed my mind');
    expect(edited?.editedTs).not.toBeNull();
  });

  it('deletes a note only after a confirmation', async () => {
    seed('day12');
    render(<CommunityPage />);
    const before = getGameState().journal.length;
    await userEvent.click(screen.getAllByRole('button', { name: 'Delete note' })[0] as HTMLElement);
    expect(getGameState().journal).toHaveLength(before);
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Delete note' }));
    expect(getGameState().journal).toHaveLength(before - 1);
  });
});

describe('notes from the team', () => {
  it('labels every card as editorial with a version, never a time, and offers no likes', async () => {
    seed('day12');
    render(<CommunityPage />);
    await openTab('From the team');

    const cards = screen.getAllByRole('article');
    expect(cards).toHaveLength(4);
    for (const card of cards) {
      expect(within(card).getByText('Editorial · Starter pack')).toBeInTheDocument();
      expect(within(card).getByText(/^v2026\.10$/)).toBeInTheDocument();
    }
    expect(screen.queryByRole('button', { name: /like/i })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Show all 8' }));
    expect(screen.getAllByRole('article')).toHaveLength(EDITORIAL_POSTS.length);
  });

  it('saves a post on this device and opens a prefilled log from "Try it"', async () => {
    seed('day12');
    render(<CommunityPage />);
    await openTab('From the team');
    const first = EDITORIAL_POSTS[0];
    const card = screen.getAllByRole('article')[0] as HTMLElement;

    await userEvent.click(within(card).getByRole('button', { name: 'Save' }));
    expect(getGameState().reactions[first?.id ?? '']).toContain('saved');
    expect(within(card).getByRole('button', { name: 'Saved' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(within(card).getByRole('link', { name: /Try it/ })).toHaveAttribute(
      'href',
      `/log?a=${first?.tryActionId}`,
    );
  });
});

describe('challenges', () => {
  it('creates a link that decodes back to the dare, and runs the visitor’s own seven days', async () => {
    seed('day12');
    render(<CommunityPage />);
    await openTab('Challenge');

    await userEvent.click(screen.getByRole('button', { name: 'Create link' }));

    const input = screen.getByLabelText('Your challenge link') as HTMLInputElement;
    const parsed = parseChallengeHash(new URL(input.value).hash);
    expect(parsed?.kind).toBe('invite');
    const decoded = decodeChallenge(parsed?.encoded ?? '');
    expect(decoded.ok && decoded.payload.k).toBe('rings_5');
    expect(decoded.ok && decoded.payload.n).toBeUndefined();
    expect(getGameState().challenge.active).toMatchObject({
      role: 'creator',
      startDay: '2026-10-06',
    });
    // One at a time: the form gives way to the running challenge.
    expect(screen.queryByRole('button', { name: 'Create link' })).not.toBeInTheDocument();
  });

  it('puts the name in the link only when asked', async () => {
    seed('day12');
    render(<CommunityPage />);
    await openTab('Challenge');
    await userEvent.click(screen.getByRole('switch', { name: /Put my name in the link/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Create link' }));

    const input = screen.getByLabelText('Your challenge link') as HTMLInputElement;
    const parsed = parseChallengeHash(new URL(input.value).hash);
    const decoded = decodeChallenge(parsed?.encoded ?? '');
    expect(decoded.ok && decoded.payload.n).toBe('Maya');
  });

  it('gives up with no penalty, after a question', async () => {
    seed('day12');
    render(<CommunityPage />);
    await openTab('Challenge');
    await userEvent.click(screen.getByRole('button', { name: 'Create link' }));
    await userEvent.click(screen.getByRole('button', { name: 'Give up' }));
    await userEvent.click(
      within(await screen.findByRole('dialog')).getByRole('button', { name: 'Give up' }),
    );
    expect(getGameState().challenge.active).toBeNull();
    expect(getGameState().challenge.history).toHaveLength(1);
  });
});

describe('opening a link', () => {
  const inviteHash = (extra: Partial<Parameters<typeof encodeChallenge>[0]> = {}) => {
    const encoded = encodeChallenge({
      v: 1,
      k: 'rings_5',
      s: '2026-10-05',
      d: 7,
      n: 'Sam',
      t: 'Juniper',
      m: 'Loser cooks dinner',
      ...extra,
    });
    return `#c=${encoded}`;
  };

  it('shows the dare, and accepting starts the visitor’s own window and clears the address', async () => {
    seed('day12');
    window.location.hash = inviteHash();
    render(<CommunityPage />);

    expect(
      screen.getByRole('heading', { name: 'Sam and Juniper dare you: five full rings in 7 days' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Loser cooks dinner')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Accept the dare' }));

    expect(getGameState().challenge.active).toMatchObject({
      role: 'friend',
      from: 'Sam',
      startDay: '2026-10-06',
    });
    expect(window.location.hash).toBe('');
    expect(screen.queryByRole('button', { name: 'Accept the dare' })).not.toBeInTheDocument();
    expect(await screen.findByText(/Sam and Juniper dare you/)).toBeInTheDocument();
  });

  it('renders free text as plain text, never markup', () => {
    seed('day12');
    window.location.hash = inviteHash({ m: '<img src=x onerror=alert(1)>' });
    const { container } = render(<CommunityPage />);
    expect(screen.getByText('<img src=x onerror=alert(1)>')).toBeInTheDocument();
    expect(container.querySelector('img[src="x"]')).toBeNull();
  });

  it('explains a damaged link in plain words and changes nothing', () => {
    seed('day12');
    window.location.hash = '#c=eyJ2IjoxfQ';
    render(<CommunityPage />);
    expect(screen.getByText('This link looks damaged. Ask for a fresh one.')).toBeInTheDocument();
    expect(getGameState().challenge.active).toBeNull();
  });

  it('says a challenge has ended once its fortnight is over', () => {
    seed('day12');
    window.location.hash = inviteHash({ s: '2026-09-01' });
    render(<CommunityPage />);
    expect(screen.getByText('This challenge has ended. Start your own?')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Start your own' })).toBeInTheDocument();
  });

  it('will not replace a running challenge without being asked', async () => {
    seed('day12');
    gameActions.createChallenge({ templateId: 'show_up_7' });
    window.location.hash = inviteHash();
    render(<CommunityPage />);

    expect(screen.getByRole('button', { name: 'Accept the dare' })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
    await userEvent.click(screen.getByRole('button', { name: 'Give up the current one' }));
    expect(getGameState().challenge.active).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Accept the dare' }));
    expect(getGameState().challenge.active?.role).toBe('friend');
  });

  it('shows a friend’s result card as self-reported', () => {
    seed('day12');
    window.location.hash = `#r=${encodeChallengeResult({ v: 1, k: 'rings_5', n: 'Maya', done: 5, of: 5, on: '2026-10-05' })}`;
    render(<CommunityPage />);
    expect(
      screen.getByRole('heading', { name: 'Maya finished: 5 / 5 full rings · self-reported' }),
    ).toBeInTheDocument();
  });

  it('round-trips: the link the creator copies is the invite the friend opens', async () => {
    seed('day12');
    const first = render(<CommunityPage />);
    await openTab('Challenge');
    await userEvent.click(screen.getByRole('button', { name: 'Create link' }));
    const url = new URL((screen.getByLabelText('Your challenge link') as HTMLInputElement).value);
    first.unmount();

    // The friend's device: no challenge yet, the link in the address bar.
    gameActions.dismissChallenge();
    window.location.hash = url.hash;
    render(<CommunityPage />);
    expect(
      screen.getByRole('heading', { name: /dares? you: five full rings in 7 days/ }),
    ).toBeInTheDocument();
  });
});

describe('the share card', () => {
  it('names the tree and offers the four toggles, with the name off by default', async () => {
    seed('day45');
    render(<CommunityPage />);
    await openTab('Share card');

    expect(
      await screen.findByRole('img', { name: /Share card preview: Fern/ }),
    ).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: 'Streak' })).toBeChecked();
    // The unit is drawn with a real subscript, so its name is read in three parts.
    expect(screen.getByRole('switch', { name: /kg CO\s*2\s*e avoided/ })).toBeChecked();
    expect(screen.getByRole('switch', { name: /This week’s rings/ })).toBeChecked();
    expect(screen.getByRole('switch', { name: /My name/ })).not.toBeChecked();
  });

  it('never puts journal text or the starting line on the card', async () => {
    seed('day200');
    render(<CommunityPage />);
    await openTab('Share card');
    const preview = await screen.findByRole('img', { name: /Share card preview/ });
    for (const note of getGameState().journal) {
      expect(preview.getAttribute('src') ?? '').not.toContain(encodeURIComponent(note.text));
    }
  });

  it('saves the SVG card when no PNG can be drawn, counts the export, and says what happened', async () => {
    seed('day45');
    const created: Blob[] = [];
    URL.createObjectURL = vi.fn((blob: Blob) => {
      created.push(blob);
      return 'blob:card';
    });
    URL.revokeObjectURL = vi.fn();
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    render(<CommunityPage />);
    await openTab('Share card');
    const exports = getGameState().seen.shareExports;

    await userEvent.click(await screen.findByRole('button', { name: 'Download PNG' }));

    await waitFor(() => expect(getGameState().seen.shareExports).toBe(exports + 1));
    expect(created[0]?.type).toBe('image/svg+xml');
    expect(screen.getByText(/saved as an SVG picture instead/)).toBeInTheDocument();
  });

  it('copies the caption', async () => {
    seed('day45');
    const writeText = vi.fn(() => Promise.resolve());
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    render(<CommunityPage />);
    await openTab('Share card');
    await userEvent.click(screen.getByRole('button', { name: 'Copy caption' }));
    expect(writeText).toHaveBeenCalledWith(
      expect.stringMatching(/^Day 35 with Fern\. .* and growing\./),
    );
    expect(await screen.findByText('Caption copied.')).toBeInTheDocument();
  });
});
