import { create } from 'zustand';

type GameState = {
  hearts: number;
  coins: number;
  level: number;
  xp: number;
  xpToNext: number;
  addCoin: () => void;
  takeDamage: () => void;
  addXp: (amount: number) => void;
};

export const useGame = create<GameState>((set, get) => ({
  hearts: 3,
  coins: 0,
  level: 1,
  xp: 0,
  xpToNext: 10,
  addCoin: () => set({ coins: get().coins + 1 }),
  takeDamage: () => set({ hearts: Math.max(0, get().hearts - 1) }),
  addXp: (amount) => {
    let { xp, xpToNext, level } = get();
    xp += amount;
    while (xp >= xpToNext) {
      xp -= xpToNext;
      level += 1;
      xpToNext = Math.round(xpToNext * 1.5);
    }
    set({ xp, xpToNext, level });
  },
}));
