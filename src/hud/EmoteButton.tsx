'use client';

import { useEmote } from '@/store/emote';

// Bottom-right corner button — gives mobile players a way to fire the
// extra emote (desktop has E/Space). Pointer-events-auto on the button so
// it punches through PointerInput's overlay.
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
        className="pointer-events-auto absolute bottom-6 right-6 flex h-16 w-16 items-center justify-center rounded-full border-2 border-neutral-700 bg-white/80 text-2xl shadow-md backdrop-blur transition active:scale-95 active:bg-neutral-200"
        aria-label="Emote"
      >
        <svg viewBox="0 0 24 24" width="28" height="28" aria-hidden>
          <path
            d="M12 2.5l2.39 6.46 6.86.36-5.27 4.39 1.74 6.65L12 16.9l-5.72 3.46 1.74-6.65L2.75 9.32l6.86-.36L12 2.5z"
            fill="#fbbf24"
            stroke="#a16207"
            strokeWidth="1.4"
            strokeLinejoin="round"
          />
        </svg>
      </button>
    </div>
  );
}
