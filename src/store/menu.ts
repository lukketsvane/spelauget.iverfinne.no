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
  // Map overlay: full-screen view of the map.png reference image.
  // Toggled by the M key (and dismissed by M / Esc / clicking the
  // overlay). Mutually exclusive with the pause menu — opening one
  // closes the other.
  showMap: boolean;
  startGame: () => void;
  startNewGame: () => void;
  endFade: () => void;
  backToMenu: () => void;
  // Drop the player back at the splash screen, resetting
  // hasStartedGame so the menu re-renders in its full-bg pixel-art
  // mode rather than as a pause overlay. The save itself isn't
  // touched — Continue still picks up where they left off.
  backToTitle: () => void;
  openSettings: () => void;
  closeSettings: () => void;
  openMap: () => void;
  closeMap: () => void;
  toggleMap: () => void;
};

export const useMenu = create<MenuState>((set) => ({
  inGame: false,
  showSettings: false,
  fadingFromBlack: false,
  hasStartedGame: false,
  showMap: false,
  startGame: () =>
    set({
      inGame: true,
      showSettings: false,
      fadingFromBlack: false,
      hasStartedGame: true,
      showMap: false,
    }),
  startNewGame: () =>
    set({
      inGame: true,
      showSettings: false,
      fadingFromBlack: true,
      hasStartedGame: true,
      showMap: false,
    }),
  endFade: () => set({ fadingFromBlack: false }),
  backToMenu: () =>
    set({ inGame: false, showSettings: false, fadingFromBlack: false, showMap: false }),
  backToTitle: () =>
    set({
      inGame: false,
      hasStartedGame: false,
      showSettings: false,
      fadingFromBlack: false,
      showMap: false,
    }),
  openSettings: () => set({ showSettings: true }),
  closeSettings: () => set({ showSettings: false }),
  openMap: () => set({ showMap: true }),
  closeMap: () => set({ showMap: false }),
  toggleMap: () => set((s) => ({ showMap: !s.showMap })),
}));
