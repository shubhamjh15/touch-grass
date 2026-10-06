import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

const WIDTH = {
  /** The widest a page gets. */
  page: 'max-w-[1120px]',
  /** One comfortable reading column: 640 px of text inside the gutters. */
  text: 'max-w-[688px]',
} as const;

export interface PageContainerProps {
  width?: keyof typeof WIDTH;
  className?: string;
  children: ReactNode;
}

/**
 * The box every page sits in: centred, with the product's gutters (16 px on a phone, 24 px
 * from tablets up, never inside a notch). App routes get it from the shell; onboarding and
 * the public pages place it themselves.
 */
export function PageContainer({ width = 'page', className, children }: PageContainerProps) {
  return (
    <div className={cn('mx-auto w-full py-6 px-gutter lg:py-10', WIDTH[width], className)}>
      {children}
    </div>
  );
}
