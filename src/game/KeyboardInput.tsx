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
      // Keyboard is binary → emit full magnitude so the run anim kicks in.
      useInput.getState().set(x, y);
    };

    const onDown = (e: KeyboardEvent) => {
      if (KEY_TO_AXIS[e.code]) {
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

    window.addEventListener('keydown', onDown);
    window.addEventListener('keyup', onUp);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onDown);
      window.removeEventListener('keyup', onUp);
      window.removeEventListener('blur', onBlur);
    };
  }, []);

  return null;
}
