'use client';

import { ChevronDown, Lock } from 'lucide-react';
import { useId, useRef, useState, type Ref } from 'react';
import { JOURNAL_MAX_CHARS, gameActions, useToday } from '@/game';
import { cn } from '@/lib/cn';
import { Button, Card, Chip, Field, Switch, Tag, TapeNote, Textarea } from '@/ui';
import { COMMUNITY_COPY } from '../copy';
import { EMPTY_DRAFT, type Draft } from '../model/draft';
import { MAIN_TAGS, MORE_TAGS, journalTagLabel } from '../model/tags';

const COPY = COMMUNITY_COPY.composer;

export interface ComposerProps {
  prompt: string;
  draft: Draft;
  onDraftChange: (draft: Draft) => void;
  textareaRef?: Ref<HTMLTextAreaElement>;
}

/**
 * Where a note is written. The prompt of the week sits on a strip of tape above it and also
 * seeds the empty field. The draft lives in the page, so switching tabs never loses a half-written note.
 */
export function Composer({ prompt, draft, onDraftChange, textareaRef }: ComposerProps) {
  const today = useToday();
  const [moreOpen, setMoreOpen] = useState(false);
  const [status, setStatus] = useState<{ text: string; ok: boolean } | null>(null);
  const moreId = useId();
  const counterId = useId();
  const local = useRef<HTMLTextAreaElement | null>(null);

  const nothingToAttach = today.logs.length === 0;
  const trimmed = draft.text.trim();
  const patch = (next: Partial<Draft>) => {
    setStatus(null);
    onDraftChange({ ...draft, ...next });
  };

  const save = () => {
    if (trimmed.length === 0) {
      setStatus({ text: COPY.empty, ok: false });
      return;
    }
    const result = gameActions.addPost({
      text: draft.text,
      tag: draft.tag,
      attachToday: draft.attach && !nothingToAttach,
    });
    if (!result.ok) {
      setStatus({ text: COPY.empty, ok: false });
      return;
    }
    onDraftChange({ ...EMPTY_DRAFT });
    setStatus({ text: result.rewarded ? COPY.savedReward : COPY.saved, ok: true });
    local.current?.focus();
  };

  const tags = moreOpen ? [...MAIN_TAGS, ...MORE_TAGS] : [...MAIN_TAGS];
  // A tag chosen from the hidden group must stay visible even when the group is folded.
  if (draft.tag && !tags.includes(draft.tag)) tags.push(draft.tag);
  const left = JOURNAL_MAX_CHARS - draft.text.length;

  return (
    <Card as="section" aria-labelledby={`${moreId}-title`} className="grid gap-4">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <h2 id={`${moreId}-title`} className="text-h3">
          {COPY.title}
        </h2>
        <Tag icon={Lock} hue="paper">
          {COPY.private}
        </Tag>
      </div>

      <TapeNote tape="pink" rotate={0} author={`${COPY.promptLabel}:`} className="max-w-prose">
        {prompt}
      </TapeNote>

      <Field label={COPY.label}>
        <Textarea
          ref={(node) => {
            local.current = node;
            if (typeof textareaRef === 'function') textareaRef(node);
            else if (textareaRef) textareaRef.current = node;
          }}
          value={draft.text}
          onChange={(event) => patch({ text: event.target.value.slice(0, JOURNAL_MAX_CHARS) })}
          maxLength={JOURNAL_MAX_CHARS}
          rows={4}
          placeholder={prompt}
          aria-describedby={counterId}
        />
      </Field>
      <p
        id={counterId}
        className={cn(
          '-mt-2 text-right font-mono text-data',
          left <= 50 ? 'font-semibold text-tomato-deep' : 'text-ink-3',
        )}
      >
        {COPY.counter(draft.text.length)}
      </p>

      <fieldset className="grid gap-2">
        <legend className="mb-1 text-label text-ink">{COPY.tagsLabel}</legend>
        <div className="flex flex-wrap gap-2" id={moreId}>
          {tags.map((tag) => (
            <Chip
              key={tag}
              selected={draft.tag === tag}
              onSelectedChange={(selected) => patch({ tag: selected ? tag : null })}
            >
              {journalTagLabel(tag)}
            </Chip>
          ))}
          <Button
            variant="ghost"
            size="sm"
            icon={ChevronDown}
            aria-expanded={moreOpen}
            aria-controls={moreId}
            onClick={() => setMoreOpen((open) => !open)}
            className={cn('[&_svg]:transition-transform', moreOpen && '[&_svg]:rotate-180')}
          >
            {moreOpen ? COPY.fewerTags : COPY.moreTags}
          </Button>
        </div>
      </fieldset>

      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-t-[1.5px] border-ink pt-4">
        <Switch
          checked={draft.attach && !nothingToAttach}
          onCheckedChange={(attach) => patch({ attach })}
          disabled={nothingToAttach}
          label={COPY.attach}
          description={nothingToAttach ? COPY.attachEmpty : COPY.attachHint}
          className="min-w-0 flex-1 basis-56"
        />
        <Button variant="primary" onClick={save} disabledReason={trimmed ? undefined : COPY.empty}>
          {COPY.save}
        </Button>
      </div>
      <p
        role="status"
        aria-live="polite"
        className={cn('min-h-5 text-body-sm', status?.ok ? 'text-green-deep' : 'text-tomato-deep')}
      >
        {status?.text ?? ''}
      </p>
    </Card>
  );
}
