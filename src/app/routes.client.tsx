'use client';

import dynamic from 'next/dynamic';
import { PageLoading } from './PageLoading';

/**
 * The app's pages read saved state from the device, so they render in the
 * browser only. Each one is its own chunk, loaded when its route is visited.
 */
export const TodayRoute = dynamic(() => import('@/features/today/TodayPage'), {
  ssr: false,
  loading: PageLoading,
});
export const LogRoute = dynamic(() => import('@/features/log/LogPage'), {
  ssr: false,
  loading: PageLoading,
});
export const QuestsRoute = dynamic(() => import('@/features/quests/QuestsPage'), {
  ssr: false,
  loading: PageLoading,
});
export const LearnRoute = dynamic(() => import('@/features/learn/LearnPage'), {
  ssr: false,
  loading: PageLoading,
});
export const LessonRoute = dynamic(() => import('@/features/learn/LessonPage'), {
  ssr: false,
  loading: PageLoading,
});
export const ImpactRoute = dynamic(() => import('@/features/impact/ImpactPage'), {
  ssr: false,
  loading: PageLoading,
});
export const CommunityRoute = dynamic(() => import('@/features/community/CommunityPage'), {
  ssr: false,
  loading: PageLoading,
});
export const CoachRoute = dynamic(() => import('@/features/coach/CoachPage'), {
  ssr: false,
  loading: PageLoading,
});
export const ProfileRoute = dynamic(() => import('@/features/profile/ProfilePage'), {
  ssr: false,
  loading: PageLoading,
});
export const OnboardingRoute = dynamic(() => import('@/features/onboarding/OnboardingPage'), {
  ssr: false,
  loading: PageLoading,
});

export const DemoRoute = dynamic(() => import('@/features/demo/DemoEntryPage'), {
  ssr: false,
  loading: PageLoading,
});

// Development workbenches. In production the import is dropped, so their code never ships.
export const UiKitRoute = dynamic(
  () =>
    process.env.NODE_ENV === 'production'
      ? Promise.resolve(() => null)
      : import('@/features/dev/UiKitPage'),
  { ssr: false, loading: PageLoading },
);
export const WorldLabRoute = dynamic(
  () =>
    process.env.NODE_ENV === 'production'
      ? Promise.resolve(() => null)
      : import('@/features/dev/WorldLabPage'),
  { ssr: false, loading: PageLoading },
);
