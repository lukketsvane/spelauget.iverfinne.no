'use client';

import { useEffect } from 'react';
import { useMenu } from '@/store/menu';

// Full-screen black overlay shown after New Game. Plays the
// `fade-from-black` keyframe (2.8 s) and then signals useMenu to clear
// the flag so the overlay unmounts. Pointer-events-none so it doesn't
// block input during the fade — the player can already start walking
// while the world brightens.
export default function BlackOverlay() {
  const fading = useMenu((s) => s.fadingFromBlack);
  const endFade = useMenu((s) => s.endFade);

  useEffect(() => {
    if (!fading) return;
    const timer = setTimeout(endFade, 2800);
    return () => clearTimeout(timer);
  }, [fading, endFade]);

  if (!fading) return null;
  return (
    <div className="pointer-events-none absolute inset-0 z-[60] animate-fade-from-black bg-black" />
  );
}
