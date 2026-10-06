/**
 * Every sentence the coach surface says by itself (Moss's answers come from the model or
 * the built-in coach in `@/ai`). Voice: design bible section 9. Short, kind, no hype.
 */
import type { AiErrorCode } from '@/ai';
import { formatNumber } from '@/lib/format';

export const COACH_COPY = {
  name: 'Moss',
  role: 'Your grove guide',
  conversationLabel: 'Conversation with Moss',
  you: 'You',
  builtInAnswer: 'Built-in answer',
  composerLabel: 'Message Moss',
  composerPlaceholder: 'Ask anything…',
  composerHint: 'Moss can be wrong. Estimates link to their sources.',
  send: 'Send',
  stop: 'Stop',
  emptyDraft: 'Type a message first.',
  busy: 'Moss is still answering. Stop it, or wait a moment.',
  thinking: 'Moss is thinking…',
  jumpToLatest: 'Jump to latest',
  newReply: 'New reply',
  moreIdeas: 'More ideas',
  fewerIdeas: 'Fewer ideas',
  promptsLabel: 'Ideas to ask Moss',
  aiFooter: 'AI-generated. Check important numbers on the',
  aiFooterLink: 'methodology page',
  retryLive: 'Retry live',
  askAgain: 'Ask again',
  continueAnswer: 'Continue',
  continuePrompt: 'Please continue from where you stopped.',
  stopped: 'Stopped here.',
  cutShort: 'This answer was cut short.',
  unreachable: "Couldn't reach Moss. Your message is still in the box.",
  tryAgain: 'Try again',
  dismiss: 'Dismiss',
  offline:
    "You're offline, so the built-in coach is answering. Your chat is still here and chips still work.",
  menuLabel: 'Chat options',
  openPage: 'Open full page',
  clearChat: 'Clear chat',
  clearTitle: 'Clear this chat?',
  clearBody:
    'Every message here is peeled off this device. Your tree, logs and streak stay as they are.',
  clearConfirm: 'Clear chat',
  clearDone: 'Chat cleared. A fresh page.',
  privacyLive: (provider: string) =>
    `Heads up: with the live coach, your message and a short summary of your stats go to ${provider} through this app's own server. Your name never does.`,
  privacyLink: 'Privacy',
  gotIt: 'Got it',
  tooLong: (over: number) =>
    `${formatNumber(over)} ${over === 1 ? 'character' : 'characters'} over. Trim it a little.`,
} as const;

/** Chips and the confirmation they open. */
export const CHIP_COPY = {
  groupLabel: 'Suggestions from Moss',
  confirmLabel: (title: string) => `Log: ${title}`,
  howMuch: 'How much?',
  stick: 'Stick it on',
  notNow: 'Not now',
  openInLog: 'Open in Log',
  avoided: 'avoided',
  versus: 'vs.',
  notEstimated: 'Not estimated.',
  kgOnly: 'Maxed for today. This one adds kilograms, not XP.',
  stuck: 'Stuck',
  undo: 'Undo',
  undone: 'Peeled off. Back to how it was.',
  undoExpired: 'Too late to undo here. You can delete it on the Log page.',
  minutes: (count: number) => `${formatNumber(count)} min read`,
  xp: (amount: number) => `+${formatNumber(amount)} XP`,
} as const;

export function stuckToastTitle(treeName: string, leaves: number, firstActToday: boolean): string {
  return firstActToday
    ? `First act today. ${treeName} is watered.`
    : `Stuck. ${treeName} grew ${formatNumber(leaves)} leaves.`;
}

/** One line under the status tag: which coach is answering, and why. */
export const STATUS_LINE = {
  checking: 'Seeing which coach is in…',
  live: (provider: string) => `${provider} is answering, through this app's own server.`,
  offline: "You're offline, so the built-in coach is answering.",
  not_configured: 'Built-in coach: notes kept on this device, not AI.',
  unreachable: "Can't reach the server, so the built-in coach is answering.",
  rate_limited: 'Moss needs a breather. The built-in coach is answering for now.',
  trouble: "The live coach isn't answering, so the built-in coach is.",
} as const;

export const STATUS_TAG = {
  checking: 'Checking',
  live: 'Live',
  builtIn: 'Built-in',
} as const;

/** The label on a built-in answer that stood in for the live coach. */
export function fallbackReason(code: AiErrorCode | undefined): string | null {
  switch (code) {
    case undefined:
    case 'not_configured':
      // The everyday case when no key is set: the "Built-in answer" slug already says it.
      return null;
    case 'offline':
      return 'You were offline, so this came from notes on this device.';
    case 'rate_limited':
      return 'Moss needed a breather, so this came from notes on this device.';
    case 'timeout':
      return 'The live coach took too long, so this came from notes on this device.';
    case 'upstream_unavailable':
    case 'invalid_request':
    case 'forbidden_origin':
    case 'too_large':
    case 'method_not_allowed':
    case 'estimate_failed':
    case 'internal':
    case 'aborted':
      return "The live coach wasn't answering, so this came from notes on this device.";
  }
}

/** What Moss says before the first message. Written here, never sent anywhere. */
export function greeting(name: string, statusLine: string): string {
  const hello = name.trim() === '' ? 'Hey.' : `Hey ${name.trim()}.`;
  return `${hello} ${statusLine} Ask me about habits, your numbers or how any of this works. Or start with one of the ideas below.`;
}

/** The "What Moss knows" sheet. */
export const KNOWS_COPY = {
  title: 'What Moss knows',
  open: 'What Moss knows',
  liveLead: (provider: string) =>
    `Sent with each message, to ${provider}, through this app's own server:`,
  builtInLead: 'Nothing leaves this device. The built-in coach reads this summary right here:',
  neverLead: 'Never sent',
  never: [
    'Your name. Moss writes a placeholder and this device fills it in.',
    'Your journal, exact times and quiz answers.',
    'The words of your custom actions.',
  ],
  shareLabel: 'Share my stats with Moss',
  shareHint: 'Off: Moss only gets your region and the action list.',
  privacy: 'Read the privacy page',
  nothingStored: 'Nothing is stored on the server.',
} as const;
