'use client';

import { useEffect } from 'react';
import { useMenu } from '@/store/menu';
import { useSettings } from '@/store/settings';

// Full-screen black overlay shown after New Game. Plays the
// `fade-from-black` keyframe (2.8 s, or 600 ms under reduceMotion) and
// then signals useMenu to clear the flag so the overlay unmounts.
// Pointer-events-none so it doesn't block input during the fade — the
// player can already start walking while the world brightens.
export default function BlackOverlay() {
  const fading = useMenu((s) => s.fadingFromBlack);
  const endFade = useMenu((s) => s.endFade);
  const reduceMotion = useSettings((s) => s.reduceMotion);

  useEffect(() => {
    if (!fading) return;
    const duration = reduceMotion ? 600 : 2800;
    const timer = setTimeout(endFade, duration);
    return () => clearTimeout(timer);
  }, [fading, endFade, reduceMotion]);

  if (!fading) return null;
  const cls = reduceMotion ? 'animate-fade-from-black-fast' : 'animate-fade-from-black';
  return (
    <div className={`pointer-events-none absolute inset-0 z-[60] ${cls} bg-black`} />
  );
}
