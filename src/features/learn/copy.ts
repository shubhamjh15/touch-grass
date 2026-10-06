import { LESSON_QUESTIONS, XP_LESSON_PASS, XP_LESSON_PERFECT_BONUS, XP_MYTH_FLIP } from '@/game';
import { pluralize } from '@/lib/format';
import type { FeaturedReason } from './model/library';

/**
 * Every sentence the Learn pages print that is not lesson content. One place, so the voice stays
 * the same from the library to the quiz result: short, kind, verb first, no guilt.
 */
export const LEARN_COPY = {
  title: 'Learn',
  lead: 'Short reads, three questions each. No doomscrolling.',
  librarySlug: (lessons: number, myths: number) =>
    `${pluralize(lessons, 'lesson')} · ${pluralize(myths, 'myth')}`,

  progressGroup: 'Your progress in Learn',
  progressLabel: 'Lessons passed',
  mythsCheckedLabel: 'Myths checked',
  progressText: (passed: number, total: number) => `${passed} of ${total} passed`,

  featured: {
    start: 'Start here',
    'resume-quiz': 'Pick up the quiz',
    continue: 'Keep reading',
    recommended: 'Up next for you',
  } satisfies Record<FeaturedReason, string>,
  featuredAction: {
    start: 'Start lesson',
    'resume-quiz': 'Resume quiz',
    continue: 'Continue lesson',
    recommended: 'Start lesson',
  } satisfies Record<FeaturedReason, string>,
  featuredReward: `${XP_LESSON_PASS} XP the first time you pass`,
  quizResume: (answered: number) =>
    `${answered} of ${LESSON_QUESTIONS} answered. It picks up at question ${answered + 1}.`,
  allPassedSlug: 'Shelf complete',
  allPassedTitle: 'All ten passed.',
  allPassedBody:
    'Every lesson stays open, so re-read any of them when a number slips your mind. The myths below are fair game too.',

  lessonsHeading: 'Lessons',
  filterLabel: 'Filter lessons by topic',
  filterAll: 'All',
  filterAnnouncement: (count: number, topic: string | null) =>
    topic
      ? `Showing ${pluralize(count, 'lesson')} about ${topic}.`
      : `Showing all ${count} lessons.`,
  filterEmptySlug: 'Nothing on this shelf',
  filterEmptyTitle: 'No lesson with this topic yet.',
  filterEmptyAction: 'Show all lessons',

  stateNew: 'New',
  stateRead: 'Read',
  statePassed: (score: number) => `Passed ${score}/${LESSON_QUESTIONS}`,
  stateQuiz: (answered: number) => `Quiz ${answered}/${LESSON_QUESTIONS}`,
  recommendedTag: 'For you',

  factSlug: "Today's fact",
  factMore: 'Tell me more',
  factBreak: 'Take a break outside',
  factWaitingTitle: (tree: string) => `Today's fact prints once ${tree} is watered.`,
  factWaitingBody: 'One fact a day, after you show up.',
  factWaitingAction: (tree: string) => `Water ${tree}`,
  factSource: 'Source',

  mythsHeading: 'Myth busters',
  mythsHint: 'Flip to check',
  mythsProgress: (checked: number, total: number) => `${checked} of ${total} checked`,
  mythsLead: `Ten things people say about climate. Flip a card to see what the evidence says. A first flip is worth ${XP_MYTH_FLIP} XP.`,
  mythTag: 'Myth',
  mythFlip: 'Flip to check',
  mythFlipBack: 'Flip back',
  mythChecked: 'Checked',
  mythReward: `+${XP_MYTH_FLIP} XP`,
  mythSource: 'Source',
  mythLesson: 'Read the lesson',
  mythListLabel: 'Myth cards',

  sourcesNote: 'Every figure on these pages names its source.',
  sourcesLink: 'How we check them',
  sourceNotes: 'Our notes',

  backToLearn: 'Learn',
  lessonReadTime: (minutes: number) => `${minutes} min read`,
  readingLabel: 'Reading progress',
  readingText: (percent: number) => `${percent}% read`,
  sourcesHeading: 'Sources',
  sourcesReview: (date: string) =>
    `Every figure was checked against its source. Next review by ${date}.`,
  newTab: '(opens in a new tab)',
  doTodayAction: 'Log it',
  doTodaySlug: 'Do this today',
  doNextHeading: 'Do this next',
  doNextMeta: 'Opens the log, ready to stick',
  doNextRow: (xp: number) => `+${xp} XP per log`,

  pagerLabel: 'More lessons',
  pagerPrevious: 'Previous',
  pagerNext: 'Next',

  notFoundSlug: 'Not on the shelf',
  notFoundTitle: 'Lesson not found.',
  notFoundBody: 'That link points at a lesson we never printed, or one that has moved.',
  notFoundSuggest: 'Maybe you were looking for',
  notFoundAction: 'Back to Learn',

  quiz: {
    slug: 'Quiz',
    heading: 'Three quick questions',
    intro: `${LESSON_QUESTIONS} questions, ${XP_LESSON_PASS} XP the first time you pass`,
    introBody: `Two right is a pass. All three on the first try adds ${XP_LESSON_PERFECT_BONUS} XP. Retries are free and unlimited.`,
    introPassed: (score: number) =>
      `Passed, ${score} of ${LESSON_QUESTIONS}. The XP was paid the first time; a retake is just for you.`,
    introTried: (best: number) =>
      `Best so far: ${best} of ${LESSON_QUESTIONS}. Two right is a pass, and the questions shuffle.`,
    start: 'Start quiz',
    retake: 'Retake quiz',
    retry: 'Try again',
    resumed: 'Picked up where you left off.',
    questionOf: (index: number) => `Question ${index} of ${LESSON_QUESTIONS}`,
    ringLabel: 'Quiz progress',
    ringText: (answered: number) => `${answered} of ${LESSON_QUESTIONS} answered`,
    optionsLabel: 'Answers',
    correct: 'Correct.',
    incorrect: 'Not quite.',
    correctAnswer: 'Right answer',
    yourAnswer: 'Your answer',
    theAnswerLead: 'Right answer:',
    youSaid: 'you said',
    next: 'Next question',
    finish: 'See result',
    resultPassed: 'Passed',
    resultPassedTitle: (score: number) => `${score} of ${LESSON_QUESTIONS}. Passed.`,
    resultPerfectTitle: 'Three for three.',
    resultMissedTitle: (score: number) => `${score} of ${LESSON_QUESTIONS} this time.`,
    resultMissedBody: `${LESSON_PASS_TEXT()} Try again? No penalty, and the answers shuffle.`,
    resultFirstPass: (xp: number, perfect: boolean) =>
      perfect
        ? `+${xp} XP: ${XP_LESSON_PASS} for the pass, ${XP_LESSON_PERFECT_BONUS} for a clean first try.`
        : `+${xp} XP for your first pass.`,
    resultRepeatPass: 'Still passed. XP is paid once per lesson, so this one was just for you.',
    reviewHeading: 'Your answers',
    reviewRight: 'Right',
    reviewMissed: 'Missed',
    nextLesson: 'Next lesson',
    nextLessonLead: 'Up next:',
    allDone: 'Back to the shelf',
    reread: 'Re-read the lesson',
    announcePass: (score: number, xp: number) =>
      xp > 0
        ? `Passed with ${score} of ${LESSON_QUESTIONS}. Plus ${xp} XP.`
        : `Passed with ${score} of ${LESSON_QUESTIONS}.`,
    announceMiss: (score: number) =>
      `${score} of ${LESSON_QUESTIONS}. Two of three passes. You can try again.`,
  },
} as const;

function LESSON_PASS_TEXT(): string {
  return `2 of ${LESSON_QUESTIONS} passes.`;
}
