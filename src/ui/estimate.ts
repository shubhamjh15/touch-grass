/**
 * Everything needed to explain one CO2e estimate: what the honesty mark opens. Built by the game
 * engine from the evidence table; the kit only displays it.
 */
export interface EstimateSource {
  /** The factor code, e.g. "MOVE-02". Also the anchor on the methodology page. */
  code: string;
  /** `factor`: a sourced emission factor. `ai`: a low-confidence AI estimate. `none`: not estimated. */
  kind: 'factor' | 'ai' | 'none';
  /** The formula actually used, e.g. "5 km × 0.171 kg/km = 0.86 kg". */
  formula: string;
  /** The comparison, in words: "Compared with driving the same trip alone in an average petrol car." */
  comparedWith: string;
  /** "0.6–1.1 kg" */
  range?: string;
  sourceLabel: string;
  year?: number;
  /** Link to the methodology entry. */
  href: string;
}
