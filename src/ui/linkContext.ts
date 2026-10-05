'use client';

import { createContext, type ComponentProps, type ComponentType } from 'react';

/** What the design system needs from a link: an anchor's props with a required `href`. */
export type UiLinkProps = Omit<ComponentProps<'a'>, 'href'> & { href: string };

/**
 * The component every `href` in the kit renders through. `null` means a plain anchor. The shell
 * provides a router-aware adapter, because `ui` may not import the router.
 */
export const UiLinkContext = createContext<ComponentType<UiLinkProps> | null>(null);
