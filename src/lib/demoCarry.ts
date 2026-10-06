/**
 * What the landing page's demo hands to onboarding: the species the visitor was looking at
 * and the first action they stuck on, so it can be offered as their real first log.
 *
 * It lives in `sessionStorage` under one key and is gone when the tab closes. It is a
 * convenience, never game state: every reader must cope with it being absent, stale or
 * damaged, which is why `readDemoCarry` validates every field and never throws.
 */

/** The key named on the Privacy page. Not prefixed: it is not part of the saved game. */
export const DEMO_CARRY_KEY = 'demoCarry';

const VERSION = 1;
const SPECIES = ['oak', 'cherry', 'pine'] as const;

export type DemoCarrySpecies = (typeof SPECIES)[number];

export interface DemoCarry {
  species: DemoCarrySpecies;
  /** Catalogue id of the first action the visitor stuck on the demo tree, if any. */
  actionId: string | null;
  /** The quantity that sticker stood for (5 km, 1 meal); `null` without an action. */
  qty: number | null;
}

const isSpecies = (value: unknown): value is DemoCarrySpecies =>
  typeof value === 'string' && (SPECIES as readonly string[]).includes(value);

/** A catalogue id is a short kebab-case slug; anything else is not worth passing on. */
const isActionId = (value: unknown): value is string =>
  typeof value === 'string' && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value) && value.length <= 64;

const isQty = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value > 0 && value <= 1000;

/** Turns stored text back into a carry, or `null` when it is missing, damaged or from another version. */
export function parseDemoCarry(raw: string | null | undefined): DemoCarry | null {
  if (!raw || raw.length > 512) return null;
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof data !== 'object' || data === null) return null;
  const record = data as Record<string, unknown>;
  if (record.v !== VERSION || !isSpecies(record.species)) return null;
  if (record.actionId === null || record.actionId === undefined) {
    return { species: record.species, actionId: null, qty: null };
  }
  if (!isActionId(record.actionId) || !isQty(record.qty)) return null;
  return { species: record.species, actionId: record.actionId, qty: record.qty };
}

function sessionStore(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.sessionStorage;
  } catch {
    // Storage can be blocked outright (private windows, strict settings).
    return null;
  }
}

/** The carry left by the landing page's demo in this tab, or `null`. Never throws. */
export function readDemoCarry(): DemoCarry | null {
  try {
    return parseDemoCarry(sessionStore()?.getItem(DEMO_CARRY_KEY));
  } catch {
    return null;
  }
}

/** Remembers the demo choice for this tab. Returns false when storage refused it. */
export function writeDemoCarry(carry: DemoCarry): boolean {
  const hasAction = carry.actionId !== null && isActionId(carry.actionId) && isQty(carry.qty);
  const payload = {
    v: VERSION,
    species: carry.species,
    actionId: hasAction ? carry.actionId : null,
    qty: hasAction ? carry.qty : null,
  };
  try {
    const store = sessionStore();
    if (!store) return false;
    store.setItem(DEMO_CARRY_KEY, JSON.stringify(payload));
    return true;
  } catch {
    return false;
  }
}

/** Forgets the carry, once the offer has been made (or declined). */
export function clearDemoCarry(): void {
  try {
    sessionStore()?.removeItem(DEMO_CARRY_KEY);
  } catch {
    // Nothing to forget if storage is unavailable.
  }
}
