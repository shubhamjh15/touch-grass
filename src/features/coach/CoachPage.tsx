'use client';

/**
 * `/coach`: Moss, full page. The same conversation as the drawer (design bible 6.10): one
 * 680 px chat column, the composer held above the tab bar on phones, and the grove along
 * for company: the 112 px sticker in the page header on phones, the shell's rail plate on
 * desktop.
 */
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { PageHeader } from '@/app/shell';
import { Avatar } from '@/ui';
import CoachPanel from './CoachPanel';
import { COACH_COPY } from './copy';

/** `/coach?q=<text>` puts a question in the box. It is never sent without the user. */
const QUESTION_PARAM = 'q';

export default function CoachPage() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  // Read once: the parameter is consumed, then removed so a reload does not refill the box.
  const [question] = useState(() => params?.get(QUESTION_PARAM)?.trim() ?? '');

  useEffect(() => {
    if (question !== '' && pathname) router.replace(pathname, { scroll: false });
  }, [question, pathname, router]);

  return (
    // The column is at least as tall as the space between the bars, so the composer sits at
    // the bottom of the screen from the first message on. The shell's extra 48 px under a
    // page (room for the Log sticker) is taken back: the composer block keeps that room itself.
    <div className="flex min-h-[calc(100dvh-var(--nav-h)-var(--safe-t)-var(--tabbar-h)-var(--safe-b)-8px)] w-full max-w-[680px] flex-col max-lg:-mb-12 lg:min-h-[calc(100dvh-160px)]">
      <CoachPanel
        variant="page"
        prefill={question === '' ? undefined : { id: question, text: question }}
        renderHeader={({ controls, statusLine, thinking }) => (
          <PageHeader slug={COACH_COPY.role} title={COACH_COPY.name} lead={statusLine}>
            <div className="flex items-center gap-3">
              <Avatar kind="moss" size={44} mood={thinking ? 'thinking' : 'happy'} />
              {controls}
            </div>
          </PageHeader>
        )}
      />
    </div>
  );
}
