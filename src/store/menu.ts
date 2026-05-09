import { create } from 'zustand';

// Menu UX state. Not persisted — every reload returns to the splash so
// the player can choose New Game vs Continue.
type MenuState = {
  inGame: boolean;
  showSettings: boolean;
  // True for ~3 s after New Game while the black overlay fades. The
  // overlay component flips this back off when its CSS animation ends.
  fadingFromBlack: boolean;
  // Once true, the menu is treated as "pause overlay" (dim canvas)
  // rather than a splash screen (full pixel-art bg). Set on first
  // entry into the game; never reset.
  hasStartedGame: boolean;
  startGame: () => void;
  startNewGame: () => void;
  endFade: () => void;
  backToMenu: () => void;
  openSettings: () => void;
  closeSettings: () => void;
};

export const useMenu = create<MenuState>((set) => ({
  inGame: false,
  showSettings: false,
  fadingFromBlack: false,
  hasStartedGame: false,
  startGame: () =>
    set({
      inGame: true,
      showSettings: false,
      fadingFromBlack: false,
      hasStartedGame: true,
    }),
  startNewGame: () =>
    set({
      inGame: true,
      showSettings: false,
      fadingFromBlack: true,
      hasStartedGame: true,
    }),
  endFade: () => set({ fadingFromBlack: false }),
  backToMenu: () => set({ inGame: false, showSettings: false, fadingFromBlack: false }),
  openSettings: () => set({ showSettings: true }),
  closeSettings: () => set({ showSettings: false }),
}));
