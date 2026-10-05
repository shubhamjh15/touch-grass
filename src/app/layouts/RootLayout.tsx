import { Outlet, ScrollRestoration } from 'react-router';
import { WorldCanvas } from '@/world';

/**
 * The one layout that never unmounts. It owns the persistent 3D world; every
 * page renders above it and reserves space for it with `<WorldStage>`.
 */
export function RootLayout() {
  return (
    <>
      <WorldCanvas />
      <div className="relative z-10">
        <Outlet />
      </div>
      <ScrollRestoration />
    </>
  );
}
