/**
 * @/app/shell — what pages may use from the app shell. Everything else under `src/app` is the
 * shell's own business.
 *
 * LAYOUT. The shell frames every app page (Today and lessons included): a centred container,
 * at most 1120 px wide, with the gutters (16 px on a phone, 24 px from tablets up), 24 px
 * above the page (40 px on a desk) and room below for the tab bar and the "Ask Moss" button.
 * So an app page renders no `<main>`, no navigation, no outer gutters, no page max-width and
 * no offset for the top bar (it is sticky and in the flow). A narrower column (640 px of
 * text) is the page's own business. `/start` and the public pages are not framed: they use
 * `<PageContainer>` themselves (`width="text"` is the reading column).
 *
 * HEADINGS. Every page has exactly one `h1`, normally through `<PageHeader title subtitle>`.
 * The shell moves focus to it on navigation.
 *
 * NAVIGATION. Today, Log, Quests, Learn, Me. Impact, Community and the Coach are reached from
 * Me and from links inside pages: `ROUTES.impact`, `ROUTES.community`, `openCoach()`. Level and
 * streak are in the top bar: pages do not repeat them.
 *
 * FEEDBACK. The shell turns game events into toasts (Undo on a log), the level-up dialog and
 * sounds. A page calls `gameActions.*` and never toasts for a game event itself.
 *
 * TITLES. Static titles come from each route file's `metadata`. Call `usePageTitle(text)`
 * only when the title depends on data.
 */
export {
  CUSTOM_LOG_LINK,
  PARAMS,
  ROUTES,
  TOUCH_GRASS_LINK,
  logLink,
  type LogLinkSource,
} from './routes';
export { takeAfterOnboardingDestination } from './guardDecision';
export { closeCoach, closePalette, openCoach, openPalette } from './shellStore';
export { PageContainer, type PageContainerProps } from './page/PageContainer';
export { PageHeader, type PageHeaderProps } from './page/PageHeader';
export { usePageTitle } from './page/usePageTitle';
export { useHideChrome } from './page/useHideChrome';
export { logToastId } from './feedback/eventFeedback';
