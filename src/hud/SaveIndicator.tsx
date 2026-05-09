'use client';

import { useEffect, useRef, useState } from 'react';
import { useLevel } from '@/store/level';

// Tiny "Saved" pill that fades in for ~1.5 s every time the autosave
// store actually writes a new position. The store already de-dupes near-
// identical positions so this fires only when meaningful progress is
// committed — not every 2 s tick.
//
// Pinned bottom-right out of the way of the inventory column on the
// left and the hearts in the top-left.
export default function SaveIndicator() {
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    let lastSig = JSON.stringify(useLevel.getState().savedPosition);
    const unsub = useLevel.subscribe((s) => {
      const sig = JSON.stringify(s.savedPosition);
      if (sig === lastSig) return;
      lastSig = sig;
      // First-write (null → coords) is most often the spawn frame after
      // a level swap. Skip that one so the pill doesn't blink each
      // teleport — only show on subsequent writes that prove the player
      // is meaningfully moving.
      if (s.savedPosition === null) return;
      setVisible(true);
      if (timerRef.current) window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(() => setVisible(false), 1500);
    });
    return () => {
      unsub();
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, []);

  return (
    <div
      className={
        'pointer-events-none absolute bottom-4 right-4 z-20 rounded-full border border-emerald-300/40 bg-emerald-950/70 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.22em] text-emerald-200 shadow-[0_4px_14px_rgba(40,180,120,0.35)] backdrop-blur transition-opacity duration-300 ' +
        (visible ? 'opacity-100' : 'opacity-0')
      }
      aria-hidden={!visible}
    >
      <span className="mr-1.5 inline-block h-1.5 w-1.5 -translate-y-[1px] rounded-full bg-emerald-300 align-middle" />
      Saved
    </div>
  );
}
