import { Outlet } from 'react-router';

/** Shell for public pages: landing, methodology, privacy. */
export function MarketingLayout() {
  return (
    <div className="min-h-dvh">
      <Outlet />
    </div>
  );
}
