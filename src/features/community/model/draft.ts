/** A note being written. The page holds it, so switching tabs never loses a half-written line. */
export interface Draft {
  text: string;
  tag: string | null;
  attach: boolean;
}

export const EMPTY_DRAFT: Draft = { text: '', tag: null, attach: false };
