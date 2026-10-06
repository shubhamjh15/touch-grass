'use client';

import { useState } from 'react';
import { gameActions } from '@/game';
import { Button, Modal, Sticker } from '@/ui';
import { COPY } from '../copy';
import type { TileState } from '../model/tiles';

/**
 * The way back for actions hidden with "Hide this action": one quiet link under the grid that
 * is only there when something is hidden, opening the list with a button per action.
 */
export function HiddenActions({ hidden }: { hidden: readonly TileState[] }) {
  const [open, setOpen] = useState(false);
  if (hidden.length === 0) return null;
  return (
    <>
      <Button variant="ghost" onClick={() => setOpen(true)}>
        {COPY.hidden.link(hidden.length)}
      </Button>
      <Modal
        open={open}
        onOpenChange={setOpen}
        title={COPY.hidden.title}
        description={COPY.hidden.body}
        size="sm"
      >
        <ul className="divide-y divide-line">
          {hidden.map(({ tile }) => (
            <li key={tile.id} className="flex items-center gap-3 py-2.5">
              <Sticker category={tile.category} icon={tile.icon} size={32} rotate={0} />
              <span className="min-w-0 flex-1 text-body font-semibold text-ink">{tile.label}</span>
              <Button
                size="sm"
                variant="neutral"
                aria-label={`${COPY.hidden.show}: ${tile.label}`}
                onClick={() => {
                  for (const actionId of tile.actionIds) gameActions.unhideAction(actionId);
                }}
              >
                {COPY.hidden.show}
              </Button>
            </li>
          ))}
        </ul>
      </Modal>
    </>
  );
}
