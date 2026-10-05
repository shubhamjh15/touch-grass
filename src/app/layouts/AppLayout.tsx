import { Outlet } from 'react-router';

/** Shell for the signed-in product: navigation, HUD and the page outlet. */
export function AppLayout() {
  return (
    <div className="min-h-dvh">
      <Outlet />
    </div>
  );
}
