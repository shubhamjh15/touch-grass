/** Every URL in the app. Link with these instead of string literals. */
export const ROUTES = {
  landing: '/',
  start: '/start',
  today: '/today',
  log: '/log',
  quests: '/quests',
  learn: '/learn',
  lesson: (lessonId: string) => `/learn/${lessonId}`,
  impact: '/impact',
  community: '/community',
  coach: '/coach',
  me: '/me',
  methodology: '/methodology',
  privacy: '/privacy',
} as const;
