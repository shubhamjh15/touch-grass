'use client';

import Link from 'next/link';
import { memo, useMemo } from 'react';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { cn } from '@/lib/cn';
import { Prose } from '@/ui';
import { internalHref } from '../model/text';

/**
 * The whole vocabulary an answer may use (product spec 8.4). Headings, tables, images and
 * code blocks are unwrapped to their text; raw HTML is dropped before it is ever parsed.
 */
const ALLOWED = ['p', 'ul', 'ol', 'li', 'strong', 'em', 'del', 'a', 'br', 'code'] as const;

/**
 * The block caret of an answer that is still arriving sits at the end of the last line of
 * text, wherever markdown put it: the last paragraph, or the last item of a closing list.
 */
const CARET = cn(
  '[&>p:last-child]:after:ml-0.5 [&>p:last-child]:after:inline-block [&>p:last-child]:after:h-[1em] [&>p:last-child]:after:w-[0.55em] [&>p:last-child]:after:animate-caret [&>p:last-child]:after:bg-ink [&>p:last-child]:after:align-[-0.12em] [&>p:last-child]:after:content-[""]',
  '[&>:is(ul,ol):last-child>li:last-child]:after:ml-0.5 [&>:is(ul,ol):last-child>li:last-child]:after:inline-block [&>:is(ul,ol):last-child>li:last-child]:after:h-[1em] [&>:is(ul,ol):last-child>li:last-child]:after:w-[0.55em] [&>:is(ul,ol):last-child>li:last-child]:after:animate-caret [&>:is(ul,ol):last-child>li:last-child]:after:bg-ink [&>:is(ul,ol):last-child>li:last-child]:after:align-[-0.12em] [&>:is(ul,ol):last-child>li:last-child]:after:content-[""]',
);

export interface CoachMarkdownProps {
  text: string;
  /** Draws the caret after the last word. */
  streaming?: boolean;
  /** Called when an in-answer link is followed (the drawer closes itself). */
  onNavigate?: () => void;
  className?: string;
}

/** A coach answer as formatted text. Only links to this app's own pages are links. */
export const CoachMarkdown = memo(function CoachMarkdown({
  text,
  streaming = false,
  onNavigate,
  className,
}: CoachMarkdownProps) {
  const components = useMemo<Components>(
    () => ({
      a({ href, children }) {
        const safe = internalHref(href);
        // An address outside the app is never a link: the words stay, the destination goes.
        if (!safe) return <>{children}</>;
        return (
          <Link href={safe} className="link" onClick={onNavigate}>
            {children}
          </Link>
        );
      },
    }),
    [onNavigate],
  );

  return (
    <Prose compact className={cn('max-w-none break-words', streaming && CARET, className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        allowedElements={ALLOWED}
        unwrapDisallowed
        skipHtml
        components={components}
      >
        {text}
      </ReactMarkdown>
    </Prose>
  );
});
