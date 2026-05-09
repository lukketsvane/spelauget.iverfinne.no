import { create } from 'zustand';
import { persist } from 'zustand/middleware';

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

// Persisted across reloads. Methods are excluded via partialize so
// localStorage stays small and the closures aren't lost on rehydrate.
export const useGame = create<GameState>()(
  persist(
    (set, get) => ({
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
    }),
    {
      name: 'spelauget.game',
      version: 1,
      partialize: (s) => ({
        hearts: s.hearts,
        coins: s.coins,
        level: s.level,
        xp: s.xp,
        xpToNext: s.xpToNext,
      }),
    },
  ),
);
