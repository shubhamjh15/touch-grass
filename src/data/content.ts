/**
 * The content barrel: lessons, myth-busters, daily facts, editorial posts, bundled datasets,
 * and the methodology and privacy pages' content. Typed, self-contained data. The action
 * catalogue is separate (`@/data/catalogue`), owned by the engine.
 */
export * from './lessons';
export { MYTHS, MYTH_BY_ID } from './myths';
export { FACTS, FACT_BY_ID, factForDay } from './facts';
export {
  CONTENT_VERSION,
  EDITORIAL_AUTHOR,
  EDITORIAL_BY_ID,
  EDITORIAL_LABEL,
  EDITORIAL_POSTS,
  type EditorialPost,
  type EditorialTag,
} from './editorial';
export * from './datasets';
export {
  ACTION_SOURCE_ROWS,
  CAN_CLAIM,
  CANNOT_CLAIM,
  CONFIDENCE_LEVELS,
  DOUBLE_COUNTING,
  FACTORS_CHANGELOG,
  FACTORS_DATE,
  FACTORS_VERSION,
  METHODOLOGY_SECTIONS,
  SOURCE_ROWS,
  WHY_RANGES_ARE_WIDE,
  WORDING_RULES,
  actionAnchor,
  contentSourceRows,
  sourceAnchor,
  type ActionSourceRow,
  type ConfidenceLevel,
  type ContentSourceRow,
  type FactorsChangelogEntry,
  type MethodologyBlock,
  type MethodologySection,
  type SourceRow,
  type WordingRules,
} from './methodology';
export {
  PRIVACY_DELETE,
  PRIVACY_EXPORT,
  PRIVACY_LEAVES,
  PRIVACY_NEVER_SENT,
  PRIVACY_NOT_USED,
  PRIVACY_SECTIONS,
  PRIVACY_STORED,
  type ExportStep,
  type LeavesItem,
  type PrivacyBlock,
  type PrivacySection,
  type StorageArea,
  type StoredItem,
} from './privacy';
export {
  allContentItems,
  claimsRegister,
  type ContentItem,
  type RegisterRow,
} from './contentItems';
