import type { ComponentProps } from 'react';
import { cn } from '@/lib/cn';

/**
 * Where the Learn pages sit on the mat. The shell's rail frame already owns the page gutters, so
 * this one adds none (a second pair made 32 px margins on a phone); it owns the room the tab bar needs, so the sections inside never repeat them.
 *
 * The library is a named container: its grids follow the width they are actually given (the
 * content column beside the rail on desktop, the full screen on a phone), not the viewport.
 */
export function LibraryFrame({ className, ...rest }: ComponentProps<'div'>) {
  return (
    <div
      className={cn(
        'mx-auto w-full max-w-(--content-max) pt-5 pb-tabbar lg:pt-8 lg:pb-16',
        className,
      )}
    >
      <div className="@container flex flex-col gap-6 md:gap-8 lg:gap-10" {...rest} />
    </div>
  );
}
