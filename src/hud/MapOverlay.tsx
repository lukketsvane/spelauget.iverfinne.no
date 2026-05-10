'use client';

import { useMenu } from '@/store/menu';

// Full-screen reference map. Toggled by the M hotkey; dismissed by
// the same key, by Esc, or by clicking anywhere on the overlay.
//
// Sits below the pause menu in z-order so opening the menu while the
// map is up still surfaces the menu cleanly. Pointer events are
// captured so clicks don't fall through to the canvas underneath
// (player would otherwise walk toward the cursor as soon as they
// dismissed the map).
export default function MapOverlay() {
  const showMap = useMenu((s) => s.showMap);
  const closeMap = useMenu((s) => s.closeMap);

  if (!showMap) return null;
  return (
    <div
      className="absolute inset-0 z-40 flex items-center justify-center bg-black/85"
      onPointerDown={closeMap}
      role="dialog"
      aria-label="Map"
    >
      <img
        src="/map/map.png"
        alt="Map of the world"
        className="max-h-full max-w-full select-none object-contain"
        // Pixel-art games look terrible smoothly resampled — keep the
        // chunky pixels even when scaled to fit the viewport.
        style={{ imageRendering: 'pixelated' }}
        draggable={false}
      />
    </div>
  );
}
