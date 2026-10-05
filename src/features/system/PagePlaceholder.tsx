import { WorldStage } from '@/world';

/** Temporary stand-in used until a route's real page lands. */
export function PagePlaceholder({ title }: { title: string }) {
  return (
    <main className="mx-auto grid min-h-dvh max-w-3xl content-center gap-6 p-6">
      <h1 className="text-5xl font-bold">{title}</h1>
      <WorldStage mode="companion" className="h-72" />
    </main>
  );
}
