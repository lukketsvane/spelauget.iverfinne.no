'use client';

import { useMenu } from '@/store/menu';

// Top-right corner pause / menu button. Tapping returns the player to
// the splash screen — the canvas stays mounted underneath, so picking
// "Continue" drops them right back where they were. Pointer-events-auto
// on the button so it punches through PointerInput's overlay.
export default function PauseMenuButton() {
  const backToMenu = useMenu((s) => s.backToMenu);

  return (
    <div className="pointer-events-none absolute inset-0 z-20">
      <button
        type="button"
        onPointerDown={(e) => {
          e.stopPropagation();
          backToMenu();
        }}
        className="pointer-events-auto absolute right-4 top-4 flex h-11 w-11 items-center justify-center rounded-full border border-violet-300/40 bg-violet-950/70 text-violet-100 shadow-[0_4px_14px_rgba(80,40,140,0.45)] backdrop-blur transition active:scale-95"
        aria-label="Menu"
      >
        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden>
          <path
            d="M4 7h16M4 12h16M4 17h16"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
          />
        </svg>
      </button>
    </div>
  );
}
