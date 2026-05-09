'use client';

import { useEffect } from 'react';
import { useMenu } from '@/store/menu';

// Desktop hotkey: M or Escape toggles between gameplay and the pause
// overlay, and backs out of the settings panel without closing the
// menu entirely. No-op on the splash menu (before the player has
// pressed New Game / Continue) so a stray Esc on the splash doesn't
// fast-forward into the game.
export default function MenuHotkey() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== 'KeyM' && e.code !== 'Escape') return;
      // Don't hijack typing in form fields (settings volume slider can
      // receive focus on tab navigation).
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
        return;
      }
      const m = useMenu.getState();
      if (!m.hasStartedGame) return;
      e.preventDefault();
      if (m.showSettings) {
        m.closeSettings();
        return;
      }
      if (m.inGame) {
        m.backToMenu();
      } else {
        m.startGame();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return null;
}
