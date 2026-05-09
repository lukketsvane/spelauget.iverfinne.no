'use client';

import { useEffect } from 'react';
import { useInput } from '@/store/input';

const KEY_TO_AXIS: Record<string, [number, number]> = {
  KeyW: [0, 1],
  ArrowUp: [0, 1],
  KeyS: [0, -1],
  ArrowDown: [0, -1],
  KeyA: [-1, 0],
  ArrowLeft: [-1, 0],
  KeyD: [1, 0],
  ArrowRight: [1, 0],
};

export default function KeyboardInput() {
  useEffect(() => {
    const held = new Set<string>();

    const apply = () => {
      let x = 0;
      let y = 0;
      for (const code of held) {
        const v = KEY_TO_AXIS[code];
        if (v) {
          x += v[0];
          y += v[1];
        }
      }
      // Diagonals shouldn't be sqrt(2) faster.
      const m = Math.hypot(x, y);
      if (m > 1) {
        x /= m;
        y /= m;
      }
      useInput.getState().setMove(x, y);
    };

    const onDown = (e: KeyboardEvent) => {
      if (KEY_TO_AXIS[e.code]) {
        // Any key press cancels an active path destination so the player
        // isn't dragged to the old tap target after manual input.
        useInput.getState().clearDestination();
        held.add(e.code);
        apply();
      }
    };
    const onUp = (e: KeyboardEvent) => {
      if (held.delete(e.code)) apply();
    };
    const onBlur = () => {
      held.clear();
      apply();
    };
    // visibilitychange catches tab-backgrounding even when window blur
    // doesn't fire (some OSes / browser configs). Without this, holding
    // 'D' and Cmd-Tabbing away leaves the character walking forever
    // until the player comes back.
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        held.clear();
        apply();
      }
    };

    window.addEventListener('keydown', onDown);
    window.addEventListener('keyup', onUp);
    window.addEventListener('blur', onBlur);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('keydown', onDown);
      window.removeEventListener('keyup', onUp);
      window.removeEventListener('blur', onBlur);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  return null;
}
