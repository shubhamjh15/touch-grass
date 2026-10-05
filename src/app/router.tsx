import type { ComponentType } from 'react';
import { createBrowserRouter, type RouteObject } from 'react-router';
import { AppLayout } from './layouts/AppLayout';
import { MarketingLayout } from './layouts/MarketingLayout';
import { RootLayout } from './layouts/RootLayout';
import { RouteError } from './RouteError';

/** Lazy-loads a page module (default export) as its own chunk. */
const page = (load: () => Promise<{ default: ComponentType }>) => async () => ({
  Component: (await load()).default,
});

// Design-system and 3D workbenches. Stripped from production builds.
const devRoutes: RouteObject[] = import.meta.env.DEV
  ? [
      { path: '__ui', lazy: page(() => import('@/features/dev/UiKitPage')) },
      { path: '__world', lazy: page(() => import('@/features/dev/WorldLabPage')) },
    ]
  : [];

export const router = createBrowserRouter([
  {
    element: <RootLayout />,
    ErrorBoundary: RouteError,
    children: [
      {
        element: <MarketingLayout />,
        children: [
          { index: true, lazy: page(() => import('@/features/landing/LandingPage')) },
          { path: 'methodology', lazy: page(() => import('@/features/legal/MethodologyPage')) },
          { path: 'privacy', lazy: page(() => import('@/features/legal/PrivacyPage')) },
        ],
      },
      { path: 'start', lazy: page(() => import('@/features/onboarding/OnboardingPage')) },
      {
        element: <AppLayout />,
        children: [
          { path: 'today', lazy: page(() => import('@/features/today/TodayPage')) },
          { path: 'log', lazy: page(() => import('@/features/log/LogPage')) },
          { path: 'quests', lazy: page(() => import('@/features/quests/QuestsPage')) },
          { path: 'learn', lazy: page(() => import('@/features/learn/LearnPage')) },
          { path: 'learn/:lessonId', lazy: page(() => import('@/features/learn/LessonPage')) },
          { path: 'impact', lazy: page(() => import('@/features/impact/ImpactPage')) },
          { path: 'community', lazy: page(() => import('@/features/community/CommunityPage')) },
          { path: 'coach', lazy: page(() => import('@/features/coach/CoachPage')) },
          { path: 'me', lazy: page(() => import('@/features/profile/ProfilePage')) },
        ],
      },
      ...devRoutes,
      { path: '*', lazy: page(() => import('@/features/system/NotFoundPage')) },
    ],
  },
]);
