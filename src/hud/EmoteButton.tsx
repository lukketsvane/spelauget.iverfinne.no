'use client';

import { useEmote } from '@/store/emote';

// Bottom-right emote button. Sits at z-20 above PointerInput (z-10) and
// stops pointer-down propagation so a tap on the star doesn't double as
// a tap-to-move on the canvas.
export default function EmoteButton() {
  const request = useEmote((s) => s.request);

  return (
    <div className="pointer-events-none absolute inset-0 z-20">
      <button
        type="button"
        onPointerDown={(e) => {
          e.stopPropagation();
          request();
        }}
        className="pointer-events-auto absolute bottom-6 right-6 flex h-16 w-16 items-center justify-center rounded-full border border-pink-300/50 bg-violet-950/70 shadow-[0_8px_24px_rgba(236,90,200,0.45)] backdrop-blur transition active:scale-95"
        aria-label="Emote"
      >
        <svg viewBox="0 0 24 24" width="30" height="30" aria-hidden>
          <path
            d="M12 2.5l2.39 6.46 6.86.36-5.27 4.39 1.74 6.65L12 16.9l-5.72 3.46 1.74-6.65L2.75 9.32l6.86-.36L12 2.5z"
            fill="#ff9bd6"
            stroke="#ffe3f2"
            strokeWidth="1.2"
            strokeLinejoin="round"
          />
        </svg>
      </button>
    </div>
  );
}
