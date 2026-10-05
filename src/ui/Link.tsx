'use client';

import { use, type ComponentType, type ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { UiLinkContext, type UiLinkProps } from './linkContext';

const EXTERNAL = /^([a-z][a-z0-9+.-]*:|\/\/)/i;

/**
 * Tells the kit how to render in-app links. Mount once in the shell with an adapter around the
 * router's `Link`, so `href` props across `@/ui` navigate without a full page load.
 */
export function UiLinkProvider({
  component,
  children,
}: {
  component: ComponentType<UiLinkProps>;
  children: ReactNode;
}) {
  return <UiLinkContext value={component}>{children}</UiLinkContext>;
}

/** An unstyled link that goes through the provided link component. The building block for linked kit parts. */
export function UiLink({ href, ...rest }: UiLinkProps) {
  const Component = use(UiLinkContext);
  if (Component && !EXTERNAL.test(href)) {
    return <Component href={href} {...rest} />;
  }
  return <a href={href} {...rest} />;
}

/** The inline text link: `blue-deep`, always underlined (colour is never the only signal). */
export function TextLink({ className, ...rest }: UiLinkProps) {
  return <UiLink className={cn('link', className)} {...rest} />;
}
