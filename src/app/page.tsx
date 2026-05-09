'use client';

import dynamic from 'next/dynamic';

const Game = dynamic(() => import('@/game/Game'), {
  ssr: false,
  loading: () => (
    <div className="flex h-screen w-screen items-center justify-center bg-white text-neutral-400">
      Loading…
    </div>
  ),
});

export default function Page() {
  return (
    <main className="relative h-screen w-screen overflow-hidden bg-white">
      <Game />
    </main>
  );
}
