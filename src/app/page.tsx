'use client';

import dynamic from 'next/dynamic';

const Game = dynamic(() => import('@/game/Game'), {
  ssr: false,
  // No loading placeholder — the menu screen is the natural visual
  // anchor while assets stream in.
  loading: () => <div className="h-screen w-screen bg-[#0a0418]" />,
});

export default function Page() {
  return (
    <main className="relative h-screen w-screen overflow-hidden bg-[#0a0418]">
      <Game />
    </main>
  );
}
