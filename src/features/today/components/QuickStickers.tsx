'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { PageSection, ROUTES } from '@/app/shell';
import { ACTIONS } from '@/data/catalogue';
import {
  gameActions,
  gameEvents,
  growPulseStrength,
  useQuickLog,
  useTreeStatus,
  type ActionState,
  type GameEventOf,
  type LogEntry,
} from '@/game';
import { formatCo2, formatNumber } from '@/lib/format';
import { useBreakpoint, useReducedMotion } from '@/lib/hooks';
import { buzz, play } from '@/lib/sfx';
import { Approx, Card, Co2e, Sticker, Tag, toast } from '@/ui';
import { getStickingPoint } from '@/world';
import { COPY, stuckTitle } from '../copy';
import { FLIGHT, leavesFor, quantityLabel, type Point } from '../model';
import { stickerLabel } from '../stickerLabels';
import { StickerFlight, type Flight } from './StickerFlight';

const STICKER_SIZE = 66;

const centreOf = (rect: DOMRect): Point => ({
  x: rect.left + rect.width / 2,
  y: rect.top + rect.height / 2,
});

/**
 * Where a flying sticker lands: the world's sticking point on the crown. When the desk has
 * scrolled over the tree (phones) it tucks in behind the desk's top edge instead of
 * landing on a card.
 */
function landingPoint(): Point {
  const fallback = { x: window.innerWidth / 2, y: Math.min(160, window.innerHeight / 3) };
  const stick = getStickingPoint() ?? fallback;
  const desk = document.querySelector('[data-today-desk]')?.getBoundingClientRect();
  if (desk && stick.x >= desk.left && stick.y >= desk.top) {
    return { x: stick.x, y: Math.max(24, desk.top - 8) };
  }
  return stick;
}

function receiptMeta(log: LogEntry) {
  const xp = log.xp > 0 ? `+${formatNumber(log.xp)} XP` : 'no XP, maxed for today';
  if (log.estimate !== 'factor' || log.co2eKg === null || log.co2eKg <= 0) return xp;
  return (
    <>
      <Approx weight="mono" />
      {formatCo2(log.co2eKg)} <Co2e /> · {xp}
    </>
  );
}

/**
 * "Stick one on": six one-tap stickers for the actions this person logs most. A press
 * peels the sticker off its slot and carries it to the tree; the log is saved the moment
 * it lands, so the tree's leaf burst, the figures and the receipt all start together.
 */
export function QuickStickers() {
  const quick = useQuickLog();
  const tree = useTreeStatus();
  const reduced = useReducedMotion();
  const desktop = useBreakpoint('lg');
  const descPrefix = useId();
  const row = useRef<HTMLDivElement>(null);
  const [flights, setFlights] = useState<Flight[]>([]);
  const [lifted, setLifted] = useState<readonly string[]>([]);
  const pending = useRef(new Map<number, { timer: number; commit: () => void }>());
  const nextFlight = useRef(0);
  const treeName = useRef(tree.name);
  useEffect(() => {
    treeName.current = tree.name;
  }, [tree.name]);

  const slotCentre = useCallback((actionId: string): Point | null => {
    const slot = row.current?.querySelector(`[data-quick="${actionId}"] svg`);
    return slot ? centreOf(slot.getBoundingClientRect()) : null;
  }, []);

  const undo = useCallback(
    (log: LogEntry) => {
      const result = gameActions.undoLog(log.id);
      if (!result.ok) {
        toast({ title: COPY.undoExpired, tone: 'info' });
        return;
      }
      play('peel');
      toast({ id: `log-${log.id}`, title: COPY.peeled, category: log.category });
      const to = slotCentre(log.actionId);
      if (reduced || !to) return;
      nextFlight.current += 1;
      const flight: Flight = {
        id: nextFlight.current,
        category: log.category,
        from: landingPoint(),
        to,
        size: STICKER_SIZE,
        back: true,
      };
      setFlights((current) => [...current, flight]);
    },
    [reduced, slotCentre],
  );

  const commit = useCallback(
    (state: ActionState) => {
      const seen: { event: GameEventOf<'action-logged'> | null } = { event: null };
      const off = gameEvents.on('action-logged', (event) => {
        seen.event = event;
      });
      const result = gameActions.logAction({
        actionId: state.action.id,
        qty: state.quickQty,
        source: 'quick',
      });
      off();
      if (!result.ok) {
        play('error');
        toast({ title: result.message ?? "That one wouldn't stick. Try it from the Log page." });
        return;
      }
      const { log } = result;
      const strength = seen.event?.strength ?? growPulseStrength(log.gp);
      toast({
        id: `log-${log.id}`,
        title: stuckTitle(
          treeName.current,
          leavesFor(strength),
          seen.event?.firstActToday === true,
        ),
        meta: receiptMeta(log),
        category: log.category,
        action: { label: COPY.undo, onClick: () => undo(log) },
      });
    },
    [undo],
  );

  // A sticker still in the air when the page goes away is saved at once: a log is never dropped.
  useEffect(() => {
    const waiting = pending.current;
    const flush = () => {
      for (const entry of waiting.values()) {
        window.clearTimeout(entry.timer);
        entry.commit();
      }
      waiting.clear();
    };
    window.addEventListener('pagehide', flush);
    return () => {
      window.removeEventListener('pagehide', flush);
      flush();
    };
  }, []);

  const stick = (state: ActionState) => {
    play('tap');
    buzz(10);
    const from = slotCentre(state.action.id);
    if (reduced || !from) {
      commit(state);
      return;
    }
    play('peel');
    nextFlight.current += 1;
    const id = nextFlight.current;
    const actionId = state.action.id;
    setLifted((current) => [...current, actionId]);
    setFlights((current) => [
      ...current,
      {
        id,
        category: state.action.category,
        from,
        to: landingPoint(),
        size: STICKER_SIZE,
        back: false,
      },
    ]);
    const land = () => {
      pending.current.delete(id);
      commit(state);
    };
    pending.current.set(id, { timer: window.setTimeout(land, FLIGHT.land), commit: land });
  };

  const onFlightDone = useCallback(
    (id: number) => {
      setFlights((current) => current.filter((flight) => flight.id !== id));
      // A new sticker is back in the slot once the old one has gone.
      setLifted((current) => (current.length === 0 ? current : current.slice(1)));
    },
    [setFlights],
  );

  const stickers = quick.map((state) => {
    const { action } = state;
    const descId = `${descPrefix}-${action.id}`;
    const blocked = state.blocked !== null;
    const kg = state.kgPerUnit === null ? null : state.kgPerUnit * state.quickQty;
    return (
      <div
        key={action.id}
        className="flex shrink-0 snap-start flex-col items-center gap-1"
        data-quick={action.id}
      >
        <Sticker
          category={action.category}
          size={STICKER_SIZE}
          label={stickerLabel(action)}
          ghost={lifted.includes(action.id)}
          disabled={blocked}
          aria-describedby={descId}
          badge={state.maxed ? <Tag hue="white">{COPY.maxed}</Tag> : undefined}
          onClick={() => stick(state)}
        />
        <span aria-hidden="true" className="type-tick text-ink-3">
          {quantityLabel(state.quickQty, action.unit)}
        </span>
        <span id={descId} className="sr-only">
          {action.title}, {quantityLabel(state.quickQty, action.unit)}
          {kg !== null && kg > 0
            ? `, about ${formatCo2(kg)} CO2e avoided compared with ${action.counterfactual}`
            : ''}
          {blocked ? `. ${state.blocked?.message ?? ''}` : state.maxed ? `. ${COPY.maxedNote}` : ''}
        </span>
      </div>
    );
  });

  return (
    <div data-coachmark="log">
      <PageSection
        id="stick"
        title={COPY.stickHeading}
        seeAll={{ href: ROUTES.log, label: `All ${formatNumber(ACTIONS.length)} actions` }}
      >
        {desktop ? (
          <Card padded={false} className="@container px-1 py-4">
            <div
              ref={row}
              className="grid grid-cols-3 justify-items-center gap-y-4 @[440px]:grid-cols-6"
            >
              {stickers}
            </div>
          </Card>
        ) : (
          <div ref={row} className="scroll-row gap-3">
            {stickers}
          </div>
        )}
      </PageSection>
      {flights.map((flight) => (
        <StickerFlight key={flight.id} flight={flight} onDone={onFlightDone} />
      ))}
    </div>
  );
}
