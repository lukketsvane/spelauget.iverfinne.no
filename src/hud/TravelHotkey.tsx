'use client';

import { useEffect } from 'react';
import { useLevel } from '@/store/level';
import { useMenu } from '@/store/menu';
import type { RegionId } from '@/game/regions';

// Number-key fast-travel between the five chain worlds. Replaces the
// old pause-menu Travel buttons — pressing 1..5 anywhere in-game
// triggers the same cinematic fade-relocate-fade as before.
//
//   1 → lysningen (Hageverden)
//   2 → blod      (Blodverden)
//   3 → geometri  (Flisverden)
//   4 → siste     (Saltverden)
//   5 → senter    (Kjellerverden)
//
// Both Digit1 and Numpad1 codes are mapped so users with numpads can
// use either row. Top-row digits also surface as `Key0..9` on some
// non-US layouts — we cover those too.
const KEY_TO_REGION: Record<string, RegionId> = {
  Digit1: 'lysningen',
  Numpad1: 'lysningen',
  Digit2: 'blod',
  Numpad2: 'blod',
  Digit3: 'geometri',
  Numpad3: 'geometri',
  Digit4: 'siste',
  Numpad4: 'siste',
  Digit5: 'senter',
  Numpad5: 'senter',
};

export default function TravelHotkey() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = KEY_TO_REGION[e.code];
      if (!target) return;
      // Don't hijack typing in form fields.
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT')) {
        return;
      }
      // Only travel when the player is actually in-game (avoid firing
      // on the splash screen before they've pressed Continue / New).
      const m = useMenu.getState();
      if (!m.hasStartedGame || !m.inGame) return;
      const lvl = useLevel.getState();
      // Skip if already in the target region — saves a needless fade.
      if (lvl.currentRegionId === target) return;
      e.preventDefault();
      lvl.travel(target);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return null;
}
