'use client';

import { ArrowRight, CircleAlert, CircleCheck, RotateCcw } from 'lucide-react';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { ROUTES } from '@/app/routes';
import type { Lesson, QuizQuestion } from '@/data/content';
import {
  LESSON_QUESTIONS,
  gameActions,
  isPass,
  type LessonResult,
  type LessonStatus,
  type QuizScore,
} from '@/game';
import { cn } from '@/lib/cn';
import { useReducedMotion } from '@/lib/hooks';
import { play } from '@/lib/sfx';
import { Button, Card, RingProgress, Stamp, Tag, TextLink, UiLink } from '@/ui';
import { emitPulse } from '@/world';
import { LEARN_COPY } from '../copy';
import {
  answerQuestion,
  currentIndex,
  isComplete,
  nextQuestion,
  optionOrder,
  resumeRun,
  runScore,
  startRun,
  type OptionIndex,
  type QuizRun,
} from '../model/quiz';
import { clearQuizDraft, readQuizDraft, saveQuizDraft } from '../model/quizDrafts';
import { plainText, richText } from '../model/richText';
import { QUIZ_ANCHOR } from './FeaturedLesson';

const COPY = LEARN_COPY.quiz;
const LETTERS = ['A', 'B', 'C'] as const;

/** What the result screen needs to know about the attempt that just ended. */
type Outcome = Extract<LessonResult, { ok: true }>;

type Phase = 'intro' | 'question' | 'result';

interface QuizState {
  phase: Phase;
  run: QuizRun | null;
  /** The run was picked up from a quiz left midway. */
  resumed: boolean;
  outcome: Outcome | null;
}

export interface QuizProps {
  lesson: Lesson;
  status: LessonStatus;
  bestScore: QuizScore;
  /** Finished attempts so far; the next attempt's number, which seeds the option order. */
  attempts: number;
  userSeed: number;
  /** The lesson to offer after a pass; `null` when every other lesson is passed. */
  next: Lesson | null;
}

type OptionMark = 'open' | 'chosen-right' | 'chosen-wrong' | 'right' | 'other';

function markOf(
  option: OptionIndex,
  chosen: OptionIndex | null,
  question: QuizQuestion,
): OptionMark {
  if (chosen === null) return 'open';
  if (option === chosen) return option === question.correct ? 'chosen-right' : 'chosen-wrong';
  return option === question.correct ? 'right' : 'other';
}

const OPTION_LOOK: Record<OptionMark, string> = {
  open: 'bg-white',
  'chosen-right': 'bg-green-tint',
  'chosen-wrong': 'bg-tomato-tint',
  right: 'border-dashed bg-white',
  other: 'border-ink-4 bg-white text-ink-3',
};

/** One answer: a full-width button with a radio-style disc. Once answered it lies flat and says what it was. */
function Option({
  letter,
  text,
  mark,
  onChoose,
}: {
  letter: string;
  text: string;
  mark: OptionMark;
  onChoose: () => void;
}) {
  const answered = mark !== 'open';
  const chosen = mark === 'chosen-right' || mark === 'chosen-wrong';
  return (
    <li>
      <button
        type="button"
        aria-disabled={answered || undefined}
        // Once answered, Tab goes from the chosen answer straight to "Next question".
        tabIndex={answered && !chosen ? -1 : undefined}
        onClick={answered ? undefined : onChoose}
        className={cn(
          'flex min-h-14 w-full hard items-center gap-3 rounded-ctl border-3 border-ink px-3.5 py-3 text-left text-body font-semibold text-ink lift-3',
          OPTION_LOOK[mark],
        )}
      >
        <span
          aria-hidden="true"
          className={cn(
            'grid size-7 shrink-0 place-items-center rounded-full border-2 border-ink font-mono text-data-sm font-semibold',
            mark === 'open' && 'bg-mat',
            mark === 'other' && 'border-ink-4',
            (mark === 'chosen-right' || mark === 'right') && 'border-0',
            mark === 'chosen-wrong' && 'border-0',
          )}
        >
          {mark === 'chosen-right' || mark === 'right' ? (
            <CircleCheck size={28} strokeWidth={2.25} />
          ) : mark === 'chosen-wrong' ? (
            <CircleAlert size={28} strokeWidth={2.25} />
          ) : (
            letter
          )}
        </span>
        <span className="min-w-0 flex-1">{richText(text)}</span>
        {chosen ? <Tag hue="white">{COPY.yourAnswer}</Tag> : null}
        {mark === 'right' ? <Tag hue="green">{COPY.correctAnswer}</Tag> : null}
      </button>
    </li>
  );
}

function initialState(lessonId: string): QuizState {
  const run = resumeRun(readQuizDraft(lessonId));
  return run
    ? { phase: 'question', run, resumed: true, outcome: null }
    : { phase: 'intro', run: null, resumed: false, outcome: null };
}

/**
 * The three-question quiz under a lesson: one question at a time, feedback with the reason after
 * every answer, a pass at two of three, and as many retries as anyone wants.
 *
 * The run lives here; the unfinished part is mirrored to the device after each answer so a quiz
 * left midway picks up at its first unanswered question. The score is handed to the store the
 * moment the third answer is given, and only the store decides about XP (once per lesson).
 */
export function Quiz({ lesson, status, bestScore, attempts, userSeed, next }: QuizProps) {
  const headingId = useId();
  const promptId = useId();
  const reduced = useReducedMotion();
  const [state, setState] = useState<QuizState>(() => initialState(lesson.id));
  const { phase, run, outcome } = state;

  const promptRef = useRef<HTMLHeadingElement>(null);
  const resultRef = useRef<HTMLHeadingElement>(null);
  // Focus follows the quiz forward, but never on arrival: the page opens at its own heading.
  const moved = useRef(false);

  const index = run ? currentIndex(run) : 0;
  const question = lesson.quiz[index] as QuizQuestion;
  const order = useMemo(
    () => optionOrder(userSeed, question.id, run?.attempt ?? attempts),
    [userSeed, question.id, run?.attempt, attempts],
  );

  useEffect(() => {
    if (!moved.current) return;
    if (phase === 'question') promptRef.current?.focus({ preventScroll: false });
    if (phase === 'result') resultRef.current?.focus({ preventScroll: false });
  }, [phase, index]);

  const start = () => {
    moved.current = true;
    clearQuizDraft(lesson.id);
    setState({ phase: 'question', run: startRun(attempts), resumed: false, outcome: null });
  };

  const choose = (option: OptionIndex) => {
    if (!run || run.revealed) return;
    const answered = answerQuestion(run, option);
    if (answered === run) return;
    const right = option === question.correct;
    play(right ? 'ring' : 'tap');

    if (!isComplete(answered)) {
      saveQuizDraft(lesson.id, answered);
      setState({ ...state, run: answered });
      return;
    }

    // The attempt is over: nothing is left to resume, and the store takes the score now, so
    // closing the page on this last piece of feedback cannot lose it.
    clearQuizDraft(lesson.id);
    const score = runScore(answered, lesson.quiz);
    const result = gameActions.completeLesson(lesson.id, score);
    setState({
      ...state,
      run: answered,
      outcome: result.ok
        ? result
        : { ok: true, passed: isPass(score), firstPass: false, perfect: false, xp: 0, score },
    });
  };

  const advance = () => {
    if (!run || !run.revealed) return;
    moved.current = true;
    if (!isComplete(run)) {
      setState({ ...state, run: nextQuestion(run), resumed: false });
      return;
    }
    if (outcome?.passed) {
      play('stamp');
      if (outcome.firstPass) emitPulse({ kind: 'celebrate' });
    }
    setState({ ...state, phase: 'result' });
  };

  const answeredCount = run ? run.answers.length : 0;
  const chosen = run?.revealed ? (run.answers[index] ?? null) : null;
  const chosenRight = chosen !== null && chosen === question.correct;

  return (
    <Card as="section" id={QUIZ_ANCHOR} aria-labelledby={headingId} className="scroll-mt-32">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="type-slug text-ink-3">
            {phase === 'question' ? COPY.questionOf(index + 1) : COPY.slug}
          </p>
          <h2 id={headingId} className="mt-2 text-h3">
            {COPY.heading}
          </h2>
        </div>
        <RingProgress
          size={48}
          tone="blue"
          value={phase === 'intro' ? 0 : answeredCount}
          max={LESSON_QUESTIONS}
          label={COPY.ringLabel}
          valueText={COPY.ringText(phase === 'intro' ? 0 : answeredCount)}
        >
          <span className="font-mono text-data-sm font-semibold">
            {phase === 'intro' ? 0 : answeredCount}/{LESSON_QUESTIONS}
          </span>
        </RingProgress>
      </div>

      {phase === 'intro' ? (
        <div className="mt-4">
          {status === 'passed' ? (
            <p className="text-body">{COPY.introPassed(bestScore)}</p>
          ) : (
            <>
              <p className="text-body font-bold">{COPY.intro}</p>
              <p className="mt-1 text-body-sm text-ink-2">
                {attempts > 0 ? COPY.introTried(bestScore) : COPY.introBody}
              </p>
            </>
          )}
          <Button
            className="mt-4"
            variant={status === 'passed' ? 'neutral' : 'info'}
            icon={status === 'passed' || attempts > 0 ? RotateCcw : undefined}
            iconRight={status === 'passed' || attempts > 0 ? undefined : ArrowRight}
            onClick={start}
          >
            {status === 'passed' ? COPY.retake : attempts > 0 ? COPY.retry : COPY.start}
          </Button>
        </div>
      ) : null}

      {phase === 'question' && run ? (
        <div className="mt-5">
          {state.resumed ? <p className="mb-2 text-caption text-ink-3">{COPY.resumed}</p> : null}
          <h3 id={promptId} ref={promptRef} tabIndex={-1} className="text-h3 outline-hidden">
            {richText(question.prompt)}
          </h3>
          <ul aria-labelledby={promptId} className="mt-4 grid gap-2.5">
            {order.map((option, position) => (
              <Option
                key={`${question.id}-${option}`}
                letter={LETTERS[position] ?? ''}
                text={question.options[option]}
                mark={markOf(option, chosen, question)}
                onChoose={() => choose(option)}
              />
            ))}
          </ul>

          <div role="status" className="mt-4">
            {chosen !== null ? (
              <div
                className={cn(
                  'flex gap-3 rounded-md border-3 border-ink p-3.5',
                  chosenRight ? 'bg-green-tint' : 'bg-tomato-tint',
                  !reduced && 'animate-stick',
                )}
              >
                {chosenRight ? (
                  <CircleCheck
                    size={24}
                    strokeWidth={2.25}
                    aria-hidden="true"
                    className="shrink-0"
                  />
                ) : (
                  <CircleAlert
                    size={24}
                    strokeWidth={2.25}
                    aria-hidden="true"
                    className="shrink-0"
                  />
                )}
                <div className="min-w-0">
                  <p className="text-body font-bold">
                    {chosenRight ? (
                      COPY.correct
                    ) : (
                      <>
                        {COPY.incorrect}{' '}
                        <span className="font-semibold">
                          {COPY.theAnswerLead} {richText(question.options[question.correct])}.
                        </span>
                      </>
                    )}
                  </p>
                  <p className="mt-1 text-body-sm">{richText(question.explanation)}</p>
                </div>
              </div>
            ) : null}
          </div>

          {chosen !== null ? (
            <Button className="mt-4" variant="info" iconRight={ArrowRight} onClick={advance}>
              {isComplete(run) ? COPY.finish : COPY.next}
            </Button>
          ) : null}
        </div>
      ) : null}

      {phase === 'result' && run && outcome ? (
        <div className="mt-5">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-4">
            {outcome.passed ? (
              <Stamp
                label={COPY.resultPassed}
                hue="green"
                rotate={-6}
                animate={!reduced}
                className="ml-1.5"
              />
            ) : null}
            <div className="min-w-0 flex-1 basis-56">
              <h3 ref={resultRef} tabIndex={-1} className="text-h2 outline-hidden">
                {!outcome.passed
                  ? COPY.resultMissedTitle(outcome.score)
                  : outcome.score === LESSON_QUESTIONS
                    ? COPY.resultPerfectTitle
                    : COPY.resultPassedTitle(outcome.score)}
              </h3>
              <p className="mt-1.5 text-body text-ink-2">
                {!outcome.passed
                  ? COPY.resultMissedBody
                  : outcome.firstPass
                    ? COPY.resultFirstPass(outcome.xp, outcome.perfect)
                    : COPY.resultRepeatPass}
              </p>
            </div>
            {outcome.xp > 0 ? (
              <Tag hue="yellow" className={cn(!reduced && 'animate-pop [animation-delay:320ms]')}>
                +{outcome.xp} XP
              </Tag>
            ) : null}
          </div>

          <h4 className="mt-6 type-slug text-ink-3">{COPY.reviewHeading}</h4>
          <ol className="mt-2.5 grid gap-2.5">
            {lesson.quiz.map((item, position) => {
              const answer = run.answers[position];
              const right = answer === item.correct;
              return (
                <li key={item.id} className="flex gap-2.5">
                  {right ? (
                    <CircleCheck
                      size={20}
                      strokeWidth={2.25}
                      aria-hidden="true"
                      className="mt-0.5 shrink-0"
                    />
                  ) : (
                    <CircleAlert
                      size={20}
                      strokeWidth={2.25}
                      aria-hidden="true"
                      className="mt-0.5 shrink-0"
                    />
                  )}
                  <div className="min-w-0">
                    <p className="text-body-sm font-semibold">
                      <span className="sr-only">
                        {right ? COPY.reviewRight : COPY.reviewMissed}:{' '}
                      </span>
                      {richText(item.prompt)}
                    </p>
                    <p className="mt-0.5 text-body-sm text-ink-2">
                      {richText(item.options[item.correct])}
                      {right ? null : (
                        <span className="text-ink-3">
                          {' '}
                          · {COPY.youSaid}{' '}
                          {answer === undefined ? '' : richText(item.options[answer])}
                        </span>
                      )}
                    </p>
                  </div>
                </li>
              );
            })}
          </ol>

          <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-3">
            {outcome.passed ? (
              <>
                <Button asChild variant="info" iconRight={ArrowRight}>
                  <UiLink href={next ? ROUTES.lesson(next.id) : ROUTES.learn}>
                    {next ? COPY.nextLesson : COPY.allDone}
                  </UiLink>
                </Button>
                <Button variant="ghost" icon={RotateCcw} onClick={start}>
                  {COPY.retake}
                </Button>
              </>
            ) : (
              <>
                <Button variant="info" icon={RotateCcw} onClick={start}>
                  {COPY.retry}
                </Button>
                <TextLink href="#lesson-top" className="inline-flex min-h-11 items-center">
                  {COPY.reread}
                </TextLink>
              </>
            )}
          </div>
          {outcome.passed && next ? (
            <p className="mt-3 text-body-sm text-ink-2">
              {COPY.nextLessonLead} <span className="font-semibold">{richText(next.title)}</span>
            </p>
          ) : null}

          <p role="status" className="sr-only">
            {outcome.passed
              ? COPY.announcePass(outcome.score, outcome.xp)
              : COPY.announceMiss(outcome.score)}
          </p>
        </div>
      ) : null}

      {phase === 'question' && chosen !== null ? (
        <p className="sr-only">
          {chosenRight
            ? ''
            : plainText(`${COPY.theAnswerLead} ${question.options[question.correct]}.`)}
        </p>
      ) : null}
    </Card>
  );
}
