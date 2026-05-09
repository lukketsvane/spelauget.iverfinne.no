import { create } from 'zustand';

// Menu UX state. Not persisted — every reload returns to the splash so
// the player can choose New Game vs Continue.
type MenuState = {
  inGame: boolean;
  showSettings: boolean;
  // True for ~3 s after New Game while the black overlay fades. The
  // overlay component flips this back off when its CSS animation ends.
  fadingFromBlack: boolean;
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
  startGame: () => set({ inGame: true, showSettings: false, fadingFromBlack: false }),
  startNewGame: () =>
    set({ inGame: true, showSettings: false, fadingFromBlack: true }),
  endFade: () => set({ fadingFromBlack: false }),
  backToMenu: () => set({ inGame: false, showSettings: false, fadingFromBlack: false }),
  openSettings: () => set({ showSettings: true }),
  closeSettings: () => set({ showSettings: false }),
}));
