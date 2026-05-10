'use client';

import { useEffect, useState } from 'react';
import { playerWorldPos } from '@/store/input';
import { useMenu } from '@/store/menu';
import { worldToMapUV } from '@/game/regions';

// Full-screen reference map. Toggled by the M hotkey; dismissed by
// the same key, by Esc, or by clicking anywhere on the overlay.
//
// Renders a "you-are-here" marker on top of the map image at the
// player's current world position, mapped through MAP_BOUNDS into
// image UV space. While the overlay is open we run a per-frame rAF
// loop that re-reads playerWorldPos and updates the marker — the
// player can still walk via WASD / arrows (keyboard listeners are
// window-level, so the overlay doesn't block them) and the marker
// tracks them in real time.
//
// Sits below the pause menu in z-order so opening the menu while the
// map is up still surfaces the menu cleanly. Pointer events are
// captured so clicks don't fall through to the canvas underneath.
export default function MapOverlay() {
  const showMap = useMenu((s) => s.showMap);
  const closeMap = useMenu((s) => s.closeMap);
  // Live UV. Seeded from the singleton playerWorldPos at mount and
  // refreshed every animation frame while the overlay is up.
  const [{ u, v }, setUV] = useState(() =>
    worldToMapUV(playerWorldPos.x, playerWorldPos.z),
  );

  useEffect(() => {
    if (!showMap) return;
    let raf = 0;
    const tick = () => {
      setUV(worldToMapUV(playerWorldPos.x, playerWorldPos.z));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [showMap]);

  if (!showMap) return null;

  return (
    <div
      className="absolute inset-0 z-40 flex items-center justify-center bg-black/85"
      onPointerDown={closeMap}
      role="dialog"
      aria-label="Map"
    >
      {/* `inline-block` makes the wrapper auto-size to the image's
          rendered dimensions, so percentage-positioned children
          (the marker) align with the map's pixel content regardless
          of viewport / aspect. */}
      <div className="relative inline-block">
        <img
          src="/map/map.png"
          alt="Map of the world"
          className="block max-h-[90vh] max-w-[90vw] select-none"
          // Pixel-art games look terrible smoothly resampled — keep
          // the chunky pixels even when scaled to fit the viewport.
          style={{ imageRendering: 'pixelated' }}
          draggable={false}
        />
        <PlayerMarker u={u} v={v} />
      </div>
    </div>
  );
}

// Pulsing pink dot with a soft halo. Centred on (u, v) via translate
// so the visual centre lands exactly on the player's mapped position
// even when the marker scales (halo grows outward, dot stays
// centred).
function PlayerMarker({ u, v }: { u: number; v: number }) {
  return (
    <div
      className="pointer-events-none absolute"
      style={{
        left: `${u * 100}%`,
        top: `${v * 100}%`,
        transform: 'translate(-50%, -50%)',
      }}
      aria-label="Your location"
    >
      <span className="relative flex h-3 w-3 items-center justify-center">
        {/* Outer halo: oversized translucent pink, animate-ping
            sends it pulsing outward every ~1.5 s. */}
        <span className="absolute inline-flex h-6 w-6 animate-ping rounded-full bg-pink-400/60" />
        {/* Inner dot: solid pink with a thin white ring so it's
            readable against any map colour. */}
        <span className="relative inline-flex h-3 w-3 rounded-full border-2 border-white bg-pink-400" />
      </span>
    </div>
  );
}
