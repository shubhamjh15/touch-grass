import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as World from './index';
import { emitWorldTap } from './interaction';
import { PULSE_SFX } from './pulses';
import { closeExplore, emitPulse, onPulse, openExplore, useWorldStore } from './store';
import { WorldExplore } from './WorldExplore';
import { WorldStage } from './WorldStage';

const play = vi.hoisted(() => vi.fn());
vi.mock('@/lib/sfx', async (original) => ({
  ...(await original<typeof import('@/lib/sfx')>()),
  play,
}));

afterEach(() => {
  act(() => closeExplore());
  act(() => useWorldStore.setState({ status: 'idle', stages: {}, activeStageId: null }));
  play.mockClear();
});

describe('the Explore API of the contract', () => {
  it('is published from the barrel under the name pages look for', () => {
    expect(typeof World.openExplore).toBe('function');
    expect(typeof World.closeExplore).toBe('function');
  });

  it('opens a labelled full-screen dialog and closes it again', () => {
    render(<WorldExplore />);
    expect(screen.queryByRole('dialog', { hidden: true })).toBeNull();
    act(() => openExplore());
    const dialog = screen.getByLabelText('Explore your island');
    expect(dialog.tagName).toBe('DIALOG');
    expect(screen.getByText('Close')).toBeInTheDocument();
    act(() => closeExplore());
    expect(screen.queryByLabelText('Explore your island')).toBeNull();
  });

  it('hands the focus back to whatever opened it', () => {
    render(
      <>
        <button type="button">Explore the island</button>
        <WorldExplore />
      </>,
    );
    const opener = screen.getByText('Explore the island');
    opener.focus();
    act(() => openExplore());
    screen.getByText('Close').focus();
    act(() => closeExplore());
    expect(document.activeElement).toBe(opener);
  });

  it('leads landmarks where the stage it was opened from leads them, then closes', () => {
    const onLandmark = vi.fn();
    render(
      <>
        <WorldStage mode="hub" landmarks onLandmark={onLandmark} />
        <WorldExplore />
      </>,
    );
    act(() => openExplore());
    const lead = useWorldStore.getState().exploreLandmark;
    expect(lead).not.toBeNull();
    act(() => lead?.('quests'));
    expect(onLandmark).toHaveBeenCalledWith('quests');
  });

  it('marks its own stage, and only that one, as the free camera', () => {
    render(
      <>
        <WorldStage mode="hub" />
        <WorldExplore />
      </>,
    );
    act(() => openExplore());
    const stages = Object.values(useWorldStore.getState().stages);
    expect(stages.filter((stage) => stage.options.explore)).toHaveLength(1);
    expect(stages.find((stage) => stage.options.explore)?.options.priority).toBeGreaterThan(100);
  });
});

describe('a stage that offers Explore', () => {
  it('shows the button once the 3D world is on it, and opens Explore from it', () => {
    render(<WorldStage mode="hub" explore />);
    expect(screen.queryByText('Explore')).toBeNull();
    act(() => useWorldStore.setState({ status: 'ready' }));
    act(() => screen.getByText('Explore').click());
    expect(useWorldStore.getState().exploring).toBe(true);
  });
});

describe('tapping something on the island', () => {
  it('says what it is and what earned it, politely', () => {
    render(<WorldStage mode="hub" />);
    act(() => useWorldStore.setState({ status: 'ready' }));
    act(() => emitWorldTap({ part: 'prop:bench', point: [0, 0, 0], clientX: 40, clientY: 200 }));
    const note = screen.getByRole('status');
    expect(note).toHaveTextContent('Bench');
    expect(note).toHaveTextContent('5 Stuff actions');
    act(() => emitWorldTap({ part: 'ground', point: [0, 0, 0], clientX: 40, clientY: 200 }));
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('offers the way in on a landmark when the page leads somewhere', () => {
    const onLandmark = vi.fn();
    render(<WorldStage mode="hub" onLandmark={onLandmark} />);
    act(() => useWorldStore.setState({ status: 'ready' }));
    act(() =>
      emitWorldTap({ part: 'landmark:coach', point: [0, 0, 0], clientX: 300, clientY: 300 }),
    );
    act(() => screen.getByText('Ask Moss').click());
    expect(onLandmark).toHaveBeenCalledWith('coach');
  });

  it('describes the island to screen readers', () => {
    act(() => useWorldStore.getState().setSnapshot({ props: ['bench', 'lantern'] }));
    render(<WorldStage mode="hub" />);
    expect(screen.getByText('On the island: bench and lantern.')).toBeInTheDocument();
    act(() => useWorldStore.getState().setSnapshot({ props: [] }));
  });
});

describe('pulse sounds', () => {
  it('stay silent unless asked for, so the app never plays one twice', () => {
    const heard = vi.fn();
    const stop = onPulse(heard);
    emitPulse({ kind: 'badge' });
    expect(play).not.toHaveBeenCalled();
    emitPulse({ kind: 'level-up', level: 3 }, { sound: true });
    expect(play).toHaveBeenCalledWith(PULSE_SFX['level-up']);
    expect(heard).toHaveBeenCalledTimes(2);
    stop();
  });
});
