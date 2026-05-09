'use client';

import dynamic from 'next/dynamic';

const Game = dynamic(() => import('@/game/Game'), {
  ssr: false,
  loading: () => (
    <div className="flex h-screen w-screen items-center justify-center bg-[#0a0418] text-violet-300">
      Loading…
    </div>
  ),
});

export default function Page() {
  return (
    <main className="relative h-screen w-screen overflow-hidden bg-[#0a0418]">
      <Game />
    </main>
  );
}
