import { create } from 'zustand';

// Menu UX state. Not persisted — every reload returns to the splash so
// the player can choose New Game vs Continue. Game progress lives in
// useLevel + useGame which ARE persisted.
type MenuState = {
  inGame: boolean;
  showSettings: boolean;
  startGame: () => void;
  openSettings: () => void;
  closeSettings: () => void;
};

export const useMenu = create<MenuState>((set) => ({
  inGame: false,
  showSettings: false,
  startGame: () => set({ inGame: true, showSettings: false }),
  openSettings: () => set({ showSettings: true }),
  closeSettings: () => set({ showSettings: false }),
}));
