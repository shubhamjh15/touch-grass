import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ComponentProps } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useCoachStore } from '@/ai';
import { getGameState } from '@/game';
import { Toaster } from '@/ui';
import { installPointerCapture } from '@/ui/testUtils';
import CoachPanel from './CoachPanel';
import { useCoachUi } from './coachUi';
import {
  delta,
  done,
  fakeApi,
  json,
  resetCoach,
  restoreClock,
  seedGame,
  sse,
} from './test/harness';

vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: ComponentProps<'a'> & { href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const COACH_KEY = 'touchgrass:coach';

function renderPanel(props: ComponentProps<typeof CoachPanel> = {}) {
  return render(
    <>
      <CoachPanel {...props} />
      <Toaster />
    </>,
  );
}

const logsOf = (actionId: string) => getGameState().logs.filter((log) => log.actionId === actionId);

async function settled(): Promise<void> {
  await waitFor(() => expect(useCoachStore.getState().isStreaming).toBe(false));
}

beforeEach(() => {
  installPointerCapture();
  seedGame('day12');
  resetCoach();
});

afterEach(() => {
  vi.unstubAllGlobals();
  restoreClock();
});

describe('first run', () => {
  it('greets by name, offers three ideas and says which coach is answering', async () => {
    fakeApi({ configured: false });
    renderPanel();

    const conversation = screen.getByRole('list', { name: 'Conversation with Moss' });
    expect(within(conversation).getByText(/^Hey Maya\. /)).toBeInTheDocument();

    const ideas = within(screen.getByRole('group', { name: 'Ideas to ask Moss' }));
    expect(ideas.getByRole('button', { name: 'One easy win for today' })).toBeInTheDocument();
    expect(ideas.getByRole('button', { name: "What's my biggest lever?" })).toBeInTheDocument();
    expect(ideas.getByRole('button', { name: 'Plan me a low-carbon dinner' })).toBeInTheDocument();
    expect(ideas.queryByRole('button', { name: 'Explain my numbers' })).not.toBeInTheDocument();

    expect(
      await screen.findByText('Built-in coach: notes kept on this device, not AI.'),
    ).toBeInTheDocument();
    expect(screen.getByText('Built-in')).toBeInTheDocument();
    expect(screen.queryByText('Live')).not.toBeInTheDocument();
  });

  it('keeps five more ideas behind "More ideas"', async () => {
    fakeApi({ configured: false });
    const user = userEvent.setup();
    renderPanel();
    const more = screen.getByRole('button', { name: 'More ideas' });
    expect(more).toHaveAttribute('aria-expanded', 'false');
    await user.click(more);
    expect(screen.getByRole('button', { name: 'Explain my numbers' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Fewer ideas' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
  });
});

describe('the built-in coach (no key on the server)', () => {
  it('answers a quick prompt, labels the answer and never calls the chat endpoint', async () => {
    const api = fakeApi({ configured: false });
    const user = userEvent.setup();
    renderPanel();

    await user.click(screen.getByRole('button', { name: 'Plan me a low-carbon dinner' }));
    await settled();

    const conversation = within(screen.getByRole('list', { name: 'Conversation with Moss' }));
    expect(conversation.getByText('Plan me a low-carbon dinner')).toBeInTheDocument();
    expect(conversation.getByText(/Built-in answer/)).toBeInTheDocument();
    expect(conversation.queryByText(/AI-generated/)).not.toBeInTheDocument();
    expect(api.chats).toHaveLength(0);
    // Screen readers get the finished answer once, through the polite region.
    const spoken = screen
      .getAllByRole('status')
      .find((node) => node.textContent?.startsWith('Moss, built-in answer: '));
    expect(spoken).toBeDefined();
    // The chat is kept on this device.
    expect(localStorage.getItem(COACH_KEY)).toContain('Plan me a low-carbon dinner');
  });

  it('a log chip asks before it logs, then logs through the engine and can be undone', async () => {
    fakeApi({ configured: false });
    const user = userEvent.setup();
    renderPanel();

    await user.click(screen.getByRole('button', { name: 'Plan me a low-carbon dinner' }));
    await settled();

    const before = logsOf('plant-based-meal').length;
    const chip = await screen.findByRole('button', { name: /^Log: Plant-based meal/ });
    expect(chip).toHaveAttribute('aria-expanded', 'false');

    await user.click(chip);
    // Opening the confirmation saves nothing.
    expect(logsOf('plant-based-meal')).toHaveLength(before);
    const confirm = within(screen.getByRole('group', { name: 'Log: Plant-based meal' }));
    // The unit is "CO<sub>2</sub>e", so the words are spread over several nodes.
    expect(
      confirm.getByText(
        (_, node) => node?.tagName === 'B' && /CO2e avoided/.test(node.textContent ?? ''),
      ),
    ).toBeInTheDocument();
    expect(confirm.getByText(/a typical meal with meat/)).toBeInTheDocument();
    expect(confirm.getByRole('button', { name: 'About this estimate' })).toBeInTheDocument();
    expect(confirm.getByRole('link', { name: 'Open in Log' })).toHaveAttribute(
      'href',
      '/log?a=plant-based-meal&src=coach',
    );

    await user.click(confirm.getByRole('button', { name: 'Stick it on' }));
    const logs = logsOf('plant-based-meal');
    expect(logs).toHaveLength(before + 1);
    expect(logs.at(-1)).toMatchObject({ source: 'coach', qty: 1 });
    expect(screen.getByText('Stuck: Plant-based meal')).toBeInTheDocument();
    expect(screen.queryByRole('group', { name: 'Log: Plant-based meal' })).not.toBeInTheDocument();

    await user.click(await screen.findByRole('button', { name: 'Undo' }));
    expect(logsOf('plant-based-meal')).toHaveLength(before);
    expect(await screen.findByText('Peeled off. Back to how it was.')).toBeInTheDocument();
    expect(screen.queryByText('Stuck: Plant-based meal')).not.toBeInTheDocument();
  });

  it('"Not now" closes the confirmation and logs nothing', async () => {
    fakeApi({ configured: false });
    const user = userEvent.setup();
    renderPanel();
    await user.click(screen.getByRole('button', { name: 'Plan me a low-carbon dinner' }));
    await settled();
    const before = getGameState().logs.length;
    const chip = await screen.findByRole('button', { name: /^Log: Plant-based meal/ });
    await user.click(chip);
    await user.click(screen.getByRole('button', { name: 'Not now' }));
    expect(screen.queryByRole('group', { name: 'Log: Plant-based meal' })).not.toBeInTheDocument();
    expect(getGameState().logs).toHaveLength(before);
    expect(chip).toHaveFocus();
  });
});

describe('the live coach', () => {
  const answer = [
    delta('Nice work, {{na'),
    delta('me}}. **Short trips** are the easy ones. See [the method](/methodology) or '),
    delta('[this site](https://example.com/tracker). <img src=x onerror="alert(1)">'),
    delta('\n\n[[log:walk-cycle-instead-of-car?qty=5]]\n[[log:not-a-real-action]]'),
    done('Groq'),
  ];

  it('streams an answer, fills the name in locally and never sends it', async () => {
    const api = fakeApi({ configured: true, chat: () => sse(answer) });
    const user = userEvent.setup();
    renderPanel();

    expect(await screen.findByText('Live')).toBeInTheDocument();
    expect(
      screen.getByText("Groq is answering, through this app's own server."),
    ).toBeInTheDocument();
    // The one-line privacy note is there before the first live message.
    expect(
      screen.getByText(/your message and a short summary of your stats go to Groq/),
    ).toBeInTheDocument();

    await user.type(screen.getByRole('textbox', { name: 'Message Moss' }), 'Any quick win?{Enter}');
    await settled();

    const conversation = within(screen.getByRole('list', { name: 'Conversation with Moss' }));
    expect(conversation.getByText(/Nice work, Maya\./)).toBeInTheDocument();
    expect(conversation.getByText(/AI-generated/)).toBeInTheDocument();

    // Markdown: bold is bold, an in-app link is a link, an outside address is plain words.
    expect(conversation.getByText('Short trips').tagName).toBe('STRONG');
    expect(conversation.getByRole('link', { name: 'the method' })).toHaveAttribute(
      'href',
      '/methodology',
    );
    expect(conversation.queryByRole('link', { name: 'this site' })).not.toBeInTheDocument();
    expect(conversation.getByText(/this site/)).toBeInTheDocument();
    // Raw HTML never becomes an element.
    expect(document.querySelector('img')).toBeNull();

    // Chips: the valid one is offered, the invented one is dropped without a trace.
    expect(
      conversation.getByRole('button', {
        name: /^Log: Walked or cycled instead of driving · 5 km/,
      }),
    ).toBeInTheDocument();
    expect(conversation.queryByText(/not-a-real-action/)).not.toBeInTheDocument();
    expect(conversation.queryByText(/\[\[/)).not.toBeInTheDocument();

    // The request: the question, the stats block, and no trace of the user's name.
    expect(api.chats).toHaveLength(1);
    expect(api.chats[0]).toMatchObject({
      messages: [{ role: 'user', content: 'Any quick win?' }],
      context: { tree: { name: 'Fern' } },
    });
    expect(api.sent.join('\n')).not.toContain('Maya');
    // Sending counts as having seen the privacy note.
    expect(getGameState().seen.coachPrivacyNotice).toBe(true);
    expect(screen.queryByText(/go to Groq through/)).not.toBeInTheDocument();
  });

  it('falls back to the built-in coach when the server is rate limited, and offers a retry', async () => {
    let calls = 0;
    const api = fakeApi({
      configured: true,
      chat: () => {
        calls += 1;
        return calls === 1
          ? json({ error: { code: 'rate_limited', message: 'slow down', retryAfterSec: 300 } }, 429)
          : sse([delta('Back again. Try the bus.'), done('Groq')]);
      },
    });
    const user = userEvent.setup();
    renderPanel();
    await screen.findByText('Live');

    await user.type(
      screen.getByRole('textbox', { name: 'Message Moss' }),
      'Explain my numbers{Enter}',
    );
    await settled();

    const conversation = within(screen.getByRole('list', { name: 'Conversation with Moss' }));
    expect(conversation.getByText(/Built-in answer/)).toBeInTheDocument();
    expect(
      conversation.getByText('Moss needed a breather, so this came from notes on this device.'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Moss needs a breather. Back in 5 min — the built-in coach is still here.'),
    ).toBeInTheDocument();
    expect(screen.getByText('Built-in')).toBeInTheDocument();

    await user.click(conversation.getByRole('button', { name: 'Retry live' }));
    await settled();
    expect(await conversation.findByText('Back again. Try the bus.')).toBeInTheDocument();
    expect(conversation.queryByText(/Built-in answer/)).not.toBeInTheDocument();
    expect(api.chats).toHaveLength(2);
    expect(screen.getByText('Live')).toBeInTheDocument();
  });

  it('keeps a partial answer when the stream breaks, and offers to continue', async () => {
    fakeApi({
      configured: true,
      chat: () =>
        sse([
          delta('Heat is the big one at home'),
          `event: error\ndata: ${JSON.stringify({ code: 'upstream_unavailable', message: 'x' })}\n\n`,
        ]),
    });
    const user = userEvent.setup();
    renderPanel();
    await screen.findByText('Live');
    await user.type(screen.getByRole('textbox', { name: 'Message Moss' }), 'Heating?{Enter}');
    await settled();

    expect(screen.getByText('Heat is the big one at home')).toBeInTheDocument();
    expect(screen.getByText('This answer was cut short.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Continue' })).toBeInTheDocument();
  });

  it('shows "Moss is thinking…" with a Stop button, and Stop ends the answer', async () => {
    let release: (() => void) | undefined;
    fakeApi({
      configured: true,
      chat: () =>
        new Promise<Response>((resolve) => {
          release = () => resolve(sse([delta('Late.'), done()]));
        }),
    });
    const user = userEvent.setup();
    renderPanel();
    await screen.findByText('Live');

    const box = screen.getByRole('textbox', { name: 'Message Moss' });
    await user.type(box, 'Plan my week{Enter}');
    expect(await screen.findByText('Moss is thinking…')).toBeInTheDocument();
    // Focus stays where the user was typing.
    expect(box).toHaveFocus();
    expect(screen.queryByRole('button', { name: 'Send' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Stop' }));
    expect(useCoachStore.getState().isStreaming).toBe(false);
    expect(screen.queryByText('Moss is thinking…')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Send' })).toBeInTheDocument();
    expect(screen.getByText('Plan my week')).toBeInTheDocument();
    await act(async () => {
      release?.();
    });
    expect(screen.queryByText('Late.')).not.toBeInTheDocument();
  });
});

describe('composer', () => {
  it('does not send an empty or over-long message, and says why', async () => {
    const api = fakeApi({ configured: true, chat: () => sse([delta('ok'), done()]) });
    const user = userEvent.setup();
    renderPanel();
    await screen.findByText('Live');

    await user.click(screen.getByRole('button', { name: 'Send' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Type a message first.');

    const box = screen.getByRole('textbox', { name: 'Message Moss' });
    await user.click(box);
    await user.paste('x'.repeat(605));
    expect(screen.getByRole('alert')).toHaveTextContent('5 characters over. Trim it a little.');
    expect(screen.getByText('605/600')).toBeInTheDocument();
    await user.keyboard('{Enter}');
    expect(api.chats).toHaveLength(0);
    expect(useCoachStore.getState().messages).toHaveLength(0);
    expect(box).toHaveValue('x'.repeat(605));
  });

  it('Shift+Enter breaks the line instead of sending', async () => {
    fakeApi({ configured: false });
    const user = userEvent.setup();
    renderPanel();
    const box = screen.getByRole('textbox', { name: 'Message Moss' });
    await user.type(box, 'one{Shift>}{Enter}{/Shift}two');
    expect(box).toHaveValue('one\ntwo');
    expect(useCoachStore.getState().messages).toHaveLength(0);
  });

  it('keeps the draft when the surface closes and opens again', async () => {
    fakeApi({ configured: false });
    const user = userEvent.setup();
    const first = renderPanel();
    await user.type(screen.getByRole('textbox', { name: 'Message Moss' }), 'half a thought');
    first.unmount();
    renderPanel();
    expect(screen.getByRole('textbox', { name: 'Message Moss' })).toHaveValue('half a thought');
  });

  it('puts a prefilled question in the box without sending it, and sends an asked one', async () => {
    fakeApi({ configured: false });
    const view = renderPanel({ prefill: { id: 1, text: 'Is recycling worth it?' } });
    expect(screen.getByRole('textbox', { name: 'Message Moss' })).toHaveValue(
      'Is recycling worth it?',
    );
    expect(useCoachStore.getState().messages).toHaveLength(0);
    view.unmount();

    useCoachUi.getState().reset();
    renderPanel({ ask: { id: 'a', text: 'Explain my numbers' } });
    await waitFor(() =>
      expect(useCoachStore.getState().messages[0]).toMatchObject({
        role: 'user',
        content: 'Explain my numbers',
      }),
    );
    await settled();
    expect(useCoachStore.getState().messages).toHaveLength(2);
  });
});

describe('history', () => {
  it('clears the chat only after a confirmation, on the device too', async () => {
    fakeApi({ configured: false });
    const user = userEvent.setup();
    renderPanel();
    await user.click(screen.getByRole('button', { name: 'One easy win for today' }));
    await settled();
    expect(localStorage.getItem(COACH_KEY)).toContain('One easy win for today');

    await user.click(screen.getByRole('button', { name: 'Chat options' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Clear chat' }));
    const dialog = within(await screen.findByRole('dialog', { name: 'Clear this chat?' }));
    expect(useCoachStore.getState().messages.length).toBeGreaterThan(0);

    await user.click(dialog.getByRole('button', { name: 'Clear chat' }));
    expect(useCoachStore.getState().messages).toHaveLength(0);
    expect(localStorage.getItem(COACH_KEY)).not.toContain('One easy win for today');
    expect(await screen.findByText(/^Hey Maya\. /)).toBeInTheDocument();
  });

  it('shows what Moss knows, and sharing can be switched off there', async () => {
    fakeApi({ configured: false });
    const user = userEvent.setup();
    renderPanel();
    await user.click(screen.getByRole('button', { name: 'What Moss knows' }));
    const sheet = within(await screen.findByRole('dialog', { name: 'What Moss knows' }));
    expect(sheet.getByText(/Nothing leaves this device/)).toBeInTheDocument();
    expect(sheet.getByText('Tree')).toBeInTheDocument();
    expect(sheet.getByText(/Your name\./)).toBeInTheDocument();

    await user.click(sheet.getByRole('switch', { name: 'Share my stats with Moss' }));
    expect(getGameState().settings.shareStatsWithCoach).toBe(false);
    expect(sheet.queryByText('Tree')).not.toBeInTheDocument();
    expect(sheet.getByText('Region')).toBeInTheDocument();
  });
});
