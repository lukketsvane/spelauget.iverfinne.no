'use client';

import { useMenu } from '@/store/menu';

// Bottom-left map toggle, sitting next to the pause button so the
// "tools" cluster lives in one corner. Mobile-only really — desktop
// players have the M hotkey — but harmless to render either way.
//
// Same chrome as PauseMenuButton (round, 44×44 for iOS-friendly
// taps, semi-transparent violet) but with a folded-map icon so the
// two buttons read as a pair without being identical.
export default function MapButton() {
  const toggleMap = useMenu((s) => s.toggleMap);

  return (
    <div className="pointer-events-none absolute inset-0 z-20">
      <button
        type="button"
        onPointerDown={(e) => {
          e.stopPropagation();
          toggleMap();
        }}
        className="pointer-events-auto absolute bottom-4 left-20 flex h-11 w-11 items-center justify-center rounded-full border border-violet-300/40 bg-violet-950/70 text-violet-100 transition active:scale-95"
        aria-label="Map"
      >
        {/* Folded-paper map: three panels with two vertical creases.
            Stroke-only so it reads at small sizes against the dim
            violet background. */}
        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden>
          <path
            d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2V6z"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
          <path
            d="M9 4v14M15 6v14"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            fill="none"
          />
        </svg>
      </button>
    </div>
  );
}
