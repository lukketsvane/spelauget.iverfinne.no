'use client';

import { useEffect, useRef, useState } from 'react';

// Tiny perf monitor pinned to the top-right corner. Counts frames in
// 500 ms windows and updates the displayed number twice a second so
// the digits don't flicker every frame. Production builds short-circuit
// to null so the overlay never ships to players.
//
// Why a manual rAF loop instead of useFrame: this component lives in
// the HTML overlay tree, not inside the R3F Canvas, and useFrame only
// works under <Canvas>.
export default function FpsOverlay() {
  const [fps, setFps] = useState(0);
  const frameCount = useRef(0);
  const lastSampleAt = useRef(performance.now());

  useEffect(() => {
    if (process.env.NODE_ENV === 'production') return;
    let raf = 0;
    const tick = () => {
      frameCount.current += 1;
      const now = performance.now();
      const elapsed = now - lastSampleAt.current;
      if (elapsed >= 500) {
        setFps(Math.round((frameCount.current / elapsed) * 1000));
        frameCount.current = 0;
        lastSampleAt.current = now;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  if (process.env.NODE_ENV === 'production') return null;
  // Color-code the number so eyeballing the corner during gameplay is
  // enough to spot a regression: green ≥55, amber ≥30, red below.
  const color = fps >= 55 ? 'text-emerald-300' : fps >= 30 ? 'text-amber-300' : 'text-rose-300';
  return (
    <div className="pointer-events-none absolute right-3 top-3 z-50">
      <div
        className={
          'rounded bg-black/55 px-2 py-1 font-mono text-[11px] tabular-nums tracking-wide ' +
          color
        }
      >
        {fps} fps
      </div>
    </div>
  );
}
