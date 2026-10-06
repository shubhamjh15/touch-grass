'use client';

import { useState } from 'react';
import { gameActions, useBaseline, type BaselineAnswers } from '@/game';
import { formatLongDate, formatTonnes } from '@/lib/format';
import {
  Approx,
  Button,
  Checkbox,
  ConfirmDialog,
  EmptyState,
  HonestyMark,
  Meter,
  Modal,
  RadioGroup,
  toast,
} from '@/ui';
import { COPY } from '../copy';
import { QUESTIONS, isComplete, splitOption, startingLineSource } from '../model/startingLine';
import { SettingsGroup } from './SettingRow';

function Quiz({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Partial<BaselineAnswers>>({});
  const [useFocus, setUseFocus] = useState(false);

  const question = QUESTIONS[step];
  const last = step === QUESTIONS.length - 1;
  const answered = question ? answers[question.id] !== undefined : false;

  const close = (next: boolean) => {
    onOpenChange(next);
    if (!next) {
      setStep(0);
      setAnswers({});
      setUseFocus(false);
    }
  };

  const save = () => {
    if (!isComplete(answers)) return;
    const result = gameActions.setBaseline(answers, { useAsFocus: useFocus });
    if (result.ok) {
      toast({ title: COPY.settings.line.saved });
      close(false);
    }
  };

  if (!question) return null;
  return (
    <Modal
      open={open}
      onOpenChange={close}
      title={COPY.settings.line.quizTitle}
      description={COPY.settings.line.quizLead}
      size="md"
      footer={
        <>
          <Button variant="neutral" onClick={() => (step === 0 ? close(false) : setStep(step - 1))}>
            {step === 0 ? COPY.settings.hidden.close : COPY.settings.line.back}
          </Button>
          {last ? (
            <Button variant="primary" disabled={!isComplete(answers)} onClick={save}>
              {COPY.settings.line.save}
            </Button>
          ) : (
            <Button variant="primary" disabled={!answered} onClick={() => setStep(step + 1)}>
              {COPY.settings.line.next}
            </Button>
          )}
        </>
      }
    >
      <div className="grid gap-4">
        <Meter
          pips
          value={step + 1}
          max={QUESTIONS.length}
          tone="blue"
          label={COPY.settings.line.progress(step + 1, QUESTIONS.length)}
          valueText={COPY.settings.line.progress(step + 1, QUESTIONS.length)}
        />
        <p className="text-h4 text-ink">{question.prompt}</p>
        <RadioGroup
          key={question.id}
          aria-label={question.prompt}
          value={answers[question.id]}
          onValueChange={(value) => setAnswers((current) => ({ ...current, [question.id]: value }))}
          options={question.options.map((option) => {
            const { title, detail } = splitOption(option.label);
            return { value: option.id, label: title, description: detail ?? undefined };
          })}
        />
        {last ? (
          <Checkbox
            checked={useFocus}
            onCheckedChange={setUseFocus}
            label={COPY.settings.line.useFocus}
          />
        ) : null}
      </div>
    </Modal>
  );
}

/**
 * The starting line: six answers make a rough yearly footprint that the pace card on Impact
 * measures your logs against. Retaking keeps the earlier result in the history; clearing removes it.
 */
export function StartingLine() {
  const baseline = useBaseline();
  const [quiz, setQuiz] = useState(false);
  const [confirm, setConfirm] = useState(false);

  return (
    <SettingsGroup
      id="starting-line"
      title={COPY.settings.line.heading}
      lead={COPY.settings.line.lead}
      label={COPY.settings.line.label}
    >
      <li className="grid gap-3 bg-card px-4 py-3.5">
        {baseline ? (
          <>
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <p className="flex items-baseline gap-1.5 font-mono text-data-lg font-semibold text-ink">
                <span>
                  <Approx weight="mono" />
                  {formatTonnes(baseline.result.tonnes.total)} CO2e
                </span>
                <span className="text-body-sm font-medium text-ink-2">
                  {COPY.settings.line.total}
                </span>
                <HonestyMark source={startingLineSource(baseline)} size="sm" />
              </p>
              <p className="type-slug text-ink-3">
                {COPY.settings.line.taken(formatLongDate(baseline.result.takenDay))}
                {baseline.retakes > 0 ? ` · ${COPY.settings.line.retakes(baseline.retakes)}` : ''}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="neutral" size="sm" onClick={() => setQuiz(true)}>
                {COPY.settings.line.retake}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setConfirm(true)}>
                {COPY.settings.line.clear}
              </Button>
            </div>
          </>
        ) : (
          <EmptyState
            slug={COPY.settings.line.none.slug}
            title={COPY.settings.line.none.title}
            body={COPY.settings.line.none.body}
            action={
              <Button variant="primary" onClick={() => setQuiz(true)}>
                {COPY.settings.line.none.action}
              </Button>
            }
            className="min-h-0"
          />
        )}
        <Quiz open={quiz} onOpenChange={setQuiz} />
        <ConfirmDialog
          open={confirm}
          onOpenChange={setConfirm}
          title={COPY.settings.line.clearTitle}
          description={COPY.settings.line.clearBody}
          confirmLabel={COPY.settings.line.clearConfirm}
          destructive
          onConfirm={() => {
            gameActions.clearBaseline();
            toast({ title: COPY.settings.line.cleared });
          }}
        />
      </li>
    </SettingsGroup>
  );
}
