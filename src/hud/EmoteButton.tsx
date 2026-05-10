'use client';

import { useEmote } from '@/store/emote';
import { useInteraction } from '@/store/interaction';

// Bottom-right interaction button. Only renders when the player is in
// range of an interactable; tapping it fires an emote (the "bow") which
// is what NPCs subscribe to in order to start their interaction.
export default function EmoteButton() {
  const available = useInteraction((s) => s.available);
  const request = useEmote((s) => s.request);

  if (!available) return null;

  return (
    <div className="pointer-events-none absolute inset-0 z-20">
      <button
        type="button"
        onPointerDown={(e) => {
          e.stopPropagation();
          request();
        }}
        className="pointer-events-auto absolute bottom-6 right-6 transition active:scale-95"
        aria-label="Click to interact"
      >
        {/* Inward 2.25-turn Archimedean-ish spiral. Each elliptical-arc
            segment is a quarter-circle whose radius shrinks by 0.5 each
            step, starting at r=10 (top) and ending at r=1 (centre). */}
        <svg viewBox="0 0 24 24" width="56" height="56" aria-hidden>
          <path
            d="M 12 2 A 9.5 9.5 0 0 1 21 12 A 8.5 8.5 0 0 1 12 20 A 7.5 7.5 0 0 1 5 12 A 6.5 6.5 0 0 1 12 6 A 5.5 5.5 0 0 1 17 12 A 4.5 4.5 0 0 1 12 16 A 3.5 3.5 0 0 1 9 12 A 2.5 2.5 0 0 1 12 10 A 1.5 1.5 0 0 1 13 12"
            fill="none"
            stroke="#ff9bd6"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
    </div>
  );
}
