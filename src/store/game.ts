import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type GameState = {
  hearts: number;
  coins: number;
  crystals: number;
  level: number;
  xp: number;
  xpToNext: number;
  // Set when the digging NPC hands the player the key. Gates the
  // teleporter — portals stay decorative until this is true.
  hasKey: boolean;
  // Set when the player has led Bobble to the parked car. Bobble
  // vanishes at that point and the car becomes interactable as a
  // gateway to The Remnants (level 3).
  bobbleVanished: boolean;
  addCoin: () => void;
  addCrystal: () => void;
  takeDamage: () => void;
  addXp: (amount: number) => void;
  giveKey: () => void;
  vanishBobble: () => void;
  reset: () => void;
};

// Persisted across reloads. Methods are excluded via partialize.
export const useGame = create<GameState>()(
  persist(
    (set, get) => ({
      hearts: 3,
      coins: 0,
      crystals: 0,
      level: 1,
      xp: 0,
      xpToNext: 10,
      hasKey: false,
      bobbleVanished: false,
      addCoin: () => set({ coins: get().coins + 1 }),
      addCrystal: () => set({ crystals: get().crystals + 1 }),
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
      giveKey: () => set({ hasKey: true }),
      vanishBobble: () => set({ bobbleVanished: true }),
      reset: () =>
        set({
          hearts: 3,
          coins: 0,
          crystals: 0,
          level: 1,
          xp: 0,
          xpToNext: 10,
          hasKey: false,
          bobbleVanished: false,
        }),
    }),
    {
      name: 'spelauget.game',
      version: 2,
      partialize: (s) => ({
        hearts: s.hearts,
        coins: s.coins,
        crystals: s.crystals,
        level: s.level,
        xp: s.xp,
        xpToNext: s.xpToNext,
        hasKey: s.hasKey,
        bobbleVanished: s.bobbleVanished,
      }),
      // v1 → v2: forward-port everything, default the new bobbleVanished
      // flag to false so existing saves still trigger Bobble's lead.
      // zustand's `migrate` is typed to return the full state shape,
      // so we cast through unknown — the partialize whitelist below
      // means consumers only see the fields we actually persist
      // anyway.
      migrate: (persistedState, version) => {
        if (version < 2 && persistedState && typeof persistedState === 'object') {
          return {
            ...(persistedState as Record<string, unknown>),
            bobbleVanished: false,
          } as unknown as GameState;
        }
        return persistedState as GameState;
      },
    },
  ),
);
