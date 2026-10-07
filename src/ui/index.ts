/**
 * The Touch Grass design system. Import everything from `@/ui`; the one exception is the command palette,
 * which lives in `@/ui/command` so cmdk loads on first open.
 */

// Tokens, types and motion constants
export {
  CATEGORY,
  CATEGORY_IDS,
  CATEGORY_ORDER,
  DEEP_TEXT,
  FILL_BG,
  HUES,
  HUE_DEEP_VAR,
  HUE_VAR,
  ROTATE,
  SWATCH_VAR,
  TINT_BG,
  isCategoryId,
  isHue,
  restRotation,
  restTilt,
  type CategoryId,
  type CategoryStyle,
  type Hue,
  type Rotation,
  type Swatch,
} from './tokens';
export { DURATIONS, EASINGS, SPRINGS, STAGGER, enterDelay, type SpringName } from './motion';
export { CATEGORY_ICON } from './categoryIcons';
export { STICKER_SHAPES, type StickerShape } from './stickerShapes';
export type { EstimateSource } from './estimate';

// Links
export { TextLink, UiLink, UiLinkProvider } from './Link';
export type { UiLinkProps } from './linkContext';

// Actions
export { Button, type ButtonProps, type ButtonSize, type ButtonVariant } from './Button';
export { IconButton, type IconButtonProps, type IconButtonVariant } from './IconButton';

// Surfaces and printed matter
export {
  Card,
  CardBody,
  CardFooter,
  CardHeader,
  type CardHeaderProps,
  type CardProps,
  type CardTone,
} from './Card';
export { Panel, type PanelProps, type PanelVariant } from './Panel';
export { Ticket, TicketStub, type TicketProps, type TicketStubProps } from './Ticket';
export { TearStub, type QuestKind, type TearStubProps, type TearStubState } from './TearStub';
export { TapeNote, type TapeNoteProps } from './TapeNote';
export { Receipt, type ReceiptProps, type ReceiptRow } from './Receipt';

// Stickers, tags, marks
export { Sticker, type StickerProps, type StickerSize } from './Sticker';
export { StickerPill, type StickerPillProps } from './StickerPill';
export { Chip, type ChipProps } from './Chip';
export { Tag, type TagProps } from './Tag';
export { Stamp, type StampProps } from './Stamp';
export { BadgeMedal, type BadgeMedalProps, type BadgeSize, type BadgeState } from './BadgeMedal';
export { Kbd } from './Kbd';
export { Avatar, type AvatarProps, type AvatarSize } from './Avatar';
export { Approx, type ApproxProps } from './Approx';
export { Co2e, Co2Text, type Co2eProps } from './Co2e';
export { ColorBar, type ColorBarProps } from './ColorBar';
export {
  CloudGlyph,
  LeafMark,
  MossFace,
  SproutGlyph,
  TreeGlyph,
  type MossMood,
  type TreeSpecies,
} from './glyphs';

// Inputs
export { Field, type FieldProps } from './Field';
export { useFieldControl } from './fieldContext';
export {
  Input,
  SearchInput,
  Textarea,
  type InputProps,
  type SearchInputProps,
  type TextareaProps,
} from './Input';
export { Select, type SelectOption, type SelectProps } from './Select';
export { Switch, type SwitchProps } from './Switch';
export {
  Checkbox,
  RadioGroup,
  type CheckboxProps,
  type RadioGroupProps,
  type RadioOption,
} from './Checkbox';
export { Segmented, type SegmentedOption, type SegmentedProps } from './Segmented';
export { TabPanel, Tabs, type TabItem, type TabPanelProps, type TabsProps } from './Tabs';
export { Slider, type SliderProps } from './Slider';

// Overlays
export { Modal, type ModalProps } from './Modal';
export { Sheet, type SheetProps } from './Sheet';
export { Tooltip, type TooltipProps } from './Tooltip';
export { Popover, type PopoverProps } from './Popover';
export { DropdownMenu, type DropdownMenuProps, type MenuItem } from './DropdownMenu';
export { Toaster } from './Toaster';
export { ToastCard, type ToastCardProps, type ToastTone } from './ToastCard';
export { dismissToast, toast, type ToastOptions } from './toast';
export { toastLater } from './toastLater';

// Data display
export { Meter, type MeterProps, type MeterTone } from './Meter';
export { XPBar, type XPBarProps } from './XPBar';
export { RingProgress, type RingProgressProps, type RingSize } from './RingProgress';
export { StatReadout, type StatReadoutProps } from './StatReadout';
export { NumberTicker, type NumberTickerProps } from './NumberTicker';
export { IconTile, Ledger, ListRow, type LedgerProps, type ListRowProps } from './Ledger';
export { EstimateDetails, HonestyMark, type HonestyMarkProps } from './HonestyMark';

// States
export {
  EmptyState,
  ErrorState,
  OfflineBanner,
  Skeleton,
  type EmptyStateProps,
  type ErrorStateProps,
  type OfflineBannerProps,
  type SkeletonProps,
} from './states';

// Headings, depth, callouts
export { Marquee, SectionHeading, type MarqueeProps, type SectionHeadingProps } from './headings';
export { Lettering, type LetteringFill, type LetteringProps } from './Lettering';
export { TiltCard, type TiltCardProps } from './TiltCard';
export { Callout, type CalloutProps } from './Callout';

// Shell helpers
export {
  ConfirmDialog,
  Prose,
  StreamCaret,
  type ConfirmDialogProps,
  type ProseProps,
} from './misc';
export { SkipLink, type SkipLinkProps } from './SkipLink';
