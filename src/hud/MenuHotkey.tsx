'use client';

import { useEffect } from 'react';
import { useMenu } from '@/store/menu';

// Desktop hotkeys:
//   Q or Esc  — toggle between gameplay and the pause overlay; also
//               backs out of the settings panel without closing the
//               menu entirely, and dismisses the map if it's open.
//   M         — toggle the reference map overlay. Pressing it while
//               the menu is open closes the menu and shows the map
//               instead (mutually exclusive overlays).
//
// All keys are no-ops on the splash menu (before the player has
// pressed New Game / Continue) so a stray Esc on the splash doesn't
// fast-forward into the game.
export default function MenuHotkey() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const isMenuKey = e.code === 'KeyQ' || e.code === 'Escape';
      const isMapKey = e.code === 'KeyM';
      if (!isMenuKey && !isMapKey) return;
      // Don't hijack typing in form fields (settings sliders can
      // receive focus on tab navigation).
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
        return;
      }
      const m = useMenu.getState();
      if (!m.hasStartedGame) return;
      e.preventDefault();

      if (isMenuKey) {
        // Map open? Close that first — Esc/Q is the universal
        // "dismiss the topmost overlay" key.
        if (m.showMap) {
          m.closeMap();
          return;
        }
        if (m.showSettings) {
          m.closeSettings();
          return;
        }
        if (m.inGame) {
          m.backToMenu();
        } else {
          m.startGame();
        }
        return;
      }

      // Map key: toggle map. Closes the menu first if it's up so the
      // map and the pause overlay don't stack.
      if (m.showMap) {
        m.closeMap();
      } else {
        if (!m.inGame) m.startGame();
        m.openMap();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return null;
}
