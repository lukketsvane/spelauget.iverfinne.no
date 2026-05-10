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
  // Spawn ids the player has picked up (crystals, etc). Lets us
  // remove the floating prop on revisit without it re-rendering.
  collectedItems: string[];
  // Spawn ids of altars the player has activated. One-shot per
  // altar — the visible crystal vanishes and the bow no longer
  // claims the interaction slot.
  activatedAltars: string[];
  addCoin: () => void;
  addCrystal: () => void;
  // Decrements the crystal stash by 1. Returns true if a crystal
  // was actually consumed, false if the inventory was empty.
  useCrystal: () => boolean;
  takeDamage: () => void;
  addXp: (amount: number) => void;
  giveKey: () => void;
  vanishBobble: () => void;
  collectItem: (id: string) => void;
  activateAltar: (id: string) => void;
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
      collectedItems: [],
      activatedAltars: [],
      addCoin: () => set({ coins: get().coins + 1 }),
      addCrystal: () => set({ crystals: get().crystals + 1 }),
      useCrystal: () => {
        const cur = get().crystals;
        if (cur <= 0) return false;
        set({ crystals: cur - 1 });
        return true;
      },
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
      collectItem: (id) => {
        const list = get().collectedItems;
        if (list.includes(id)) return;
        set({ collectedItems: [...list, id] });
      },
      activateAltar: (id) => {
        const list = get().activatedAltars;
        if (list.includes(id)) return;
        set({ activatedAltars: [...list, id] });
      },
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
          collectedItems: [],
          activatedAltars: [],
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
        collectedItems: s.collectedItems,
        activatedAltars: s.activatedAltars,
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
