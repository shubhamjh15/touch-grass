'use client';

import { Pencil, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { JOURNAL_MAX_CHARS, gameActions, type JournalNote } from '@/game';
import { formatDay, formatTime } from '@/lib/format';
import type { DayKey } from '@/lib/dates';
import { Button, Card, Chip, ConfirmDialog, Field, IconButton, Tag, Textarea } from '@/ui';
import { COMMUNITY_COPY } from '../copy';
import { MAIN_TAGS, journalTagLabel, tagHue } from '../model/tags';

const COPY = COMMUNITY_COPY.journal;

export interface NoteCardProps {
  note: JournalNote;
  today: DayKey;
}

/** One journal note on paper: its text, the line about the day it was attached to, edit and delete. */
export function NoteCard({ note, today }: NoteCardProps) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(note.text);
  const [tag, setTag] = useState<string | null>(note.tag);
  const [confirming, setConfirming] = useState(false);

  const startEditing = () => {
    setText(note.text);
    setTag(note.tag);
    setEditing(true);
  };

  const saveEdit = () => {
    const result = gameActions.editPost(note.id, { text, tag });
    if (result.ok) setEditing(false);
  };

  const tagChoices =
    tag && !(MAIN_TAGS as readonly string[]).includes(tag) ? [...MAIN_TAGS, tag] : MAIN_TAGS;

  return (
    <Card
      as="article"
      tone="paper"
      className="grid grid-cols-1 content-start gap-3"
      aria-label={`Note, ${formatDay(note.day, today)}`}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="type-slug text-ink-3">
          {formatDay(note.day, today)} · {formatTime(note.ts)}
          {note.editedTs !== null ? ` · ${COPY.edited}` : ''}
        </p>
        {!editing ? (
          <div className="-mt-2 -mr-2 flex shrink-0 gap-1">
            <IconButton label={COPY.edit} icon={Pencil} size="sm" onClick={startEditing} />
            <IconButton
              label={COPY.delete}
              icon={Trash2}
              size="sm"
              onClick={() => setConfirming(true)}
            />
          </div>
        ) : null}
      </div>

      {editing ? (
        <div className="grid grid-cols-1 gap-3">
          <Field label={COPY.editLabel}>
            <Textarea
              value={text}
              onChange={(event) => setText(event.target.value.slice(0, JOURNAL_MAX_CHARS))}
              rows={4}
              autoFocus
            />
          </Field>
          <div className="flex flex-wrap gap-2">
            {tagChoices.map((choice) => (
              <Chip
                key={choice}
                selected={tag === choice}
                onSelectedChange={(selected) => setTag(selected ? choice : null)}
              >
                {journalTagLabel(choice)}
              </Chip>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="primary"
              size="sm"
              onClick={saveEdit}
              disabledReason={text.trim() ? undefined : COMMUNITY_COPY.composer.empty}
            >
              {COPY.saveEdit}
            </Button>
            <Button variant="neutral" size="sm" onClick={() => setEditing(false)}>
              {COPY.cancel}
            </Button>
          </div>
        </div>
      ) : (
        <>
          <p className="text-body leading-relaxed break-words whitespace-pre-wrap">{note.text}</p>
          {note.attachment ? (
            <p className="rounded-sm bg-green-tint px-3 py-2 text-body-sm text-ink-2">
              {note.attachment}
            </p>
          ) : null}
          {note.tag ? (
            <div>
              <Tag hue={tagHue(note.tag)}>{journalTagLabel(note.tag)}</Tag>
            </div>
          ) : null}
        </>
      )}

      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={COPY.deleteTitle}
        description={COPY.deleteBody}
        confirmLabel={COPY.deleteConfirm}
        destructive
        onConfirm={() => gameActions.deletePost(note.id)}
      />
    </Card>
  );
}
