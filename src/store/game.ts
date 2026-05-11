import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { RegionId } from '@/game/regions';

type GameState = {
  hearts: number;
  coins: number;
  crystals: number;
  level: number;
  xp: number;
  xpToNext: number;
  // Legacy: true if the player has at least one key. Kept as a bool
  // mirror of `keys.length > 0` so the existing Spawns / HUD / Portal
  // / DiggerBeacon / MainMenu code keeps reading the same shape. New
  // code should read `keys` directly via `hasKeyFor(region)`.
  hasKey: boolean;
  // Set when the player has led Bobble to the parked car. Bobble
  // vanishes at that point and the car becomes interactable as a
  // gateway to The Remnants (level 3).
  bobbleVanished: boolean;
  // Per-portal key inventory. Each entry is the RegionId of the
  // region that key opens the portal TO. So `keys.includes('blod')`
  // means the player can step through any portal whose
  // `requiredKey === 'blod'`.
  keys: RegionId[];
  // Hidden, optional collectibles — one per outer world. The mandala
  // ending in `senter` reads this list as a 4-bit bitmask to pick
  // among 16 possible end-state configurations.
  artifacts: RegionId[];
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
  // Legacy entry-point — the digger NPC's key. Maps onto the new
  // multi-key system by adding the 'stjerneengen' key (which gates
  // the original portal at the east edge of Lysningen).
  giveKey: () => void;
  // Idempotent: adds `region` to keys[] if missing. Bumps `hasKey`.
  addKey: (region: RegionId) => void;
  // Idempotent: marks the artefact for `region` as collected.
  addArtifact: (region: RegionId) => void;
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
      keys: [],
      artifacts: [],
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
      // Digger's key now opens the FIRST portal in the 5-world chain
      // (lysningen → blod). Routed through addKey so the multi-key
      // system stays the source of truth, and `hasKey` ticks to true
      // as a side effect for any legacy reads.
      giveKey: () => get().addKey('blod'),
      addKey: (region) => {
        const cur = get().keys;
        if (cur.includes(region)) return;
        const next = [...cur, region];
        set({ keys: next, hasKey: next.length > 0 });
      },
      addArtifact: (region) => {
        const cur = get().artifacts;
        if (cur.includes(region)) return;
        set({ artifacts: [...cur, region] });
      },
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
          keys: [],
          artifacts: [],
          collectedItems: [],
          activatedAltars: [],
        }),
    }),
    {
      name: 'spelauget.game',
      version: 4,
      partialize: (s) => ({
        hearts: s.hearts,
        coins: s.coins,
        crystals: s.crystals,
        level: s.level,
        xp: s.xp,
        xpToNext: s.xpToNext,
        hasKey: s.hasKey,
        bobbleVanished: s.bobbleVanished,
        keys: s.keys,
        artifacts: s.artifacts,
        collectedItems: s.collectedItems,
        activatedAltars: s.activatedAltars,
      }),
      // v1 → v2: forward-port everything, default the new bobbleVanished
      // flag to false so existing saves still trigger Bobble's lead.
      // v2 → v3: introduce keys[] / artifacts[]. Seed keys with 'blod'
      // when the legacy hasKey bool was true so the digger's gift still
      // unlocks the first chain portal under the new model.
      // v3 → v4: digger key changed target from 'stjerneengen' to 'blod'
      // — rewrite any stale 'stjerneengen' entry in keys[] so saves
      // taken between the v3 ship and the v4 fix unlock the right
      // portal. zustand's `migrate` returns the full state shape, so
      // we cast through unknown — partialize below limits what
      // consumers actually read.
      migrate: (persistedState, version) => {
        if (!persistedState || typeof persistedState !== 'object') {
          return persistedState as GameState;
        }
        const obj = persistedState as Record<string, unknown>;
        if (version < 2) {
          obj.bobbleVanished = false;
        }
        if (version < 3) {
          const legacyHasKey = !!obj.hasKey;
          obj.keys = legacyHasKey ? (['blod'] as RegionId[]) : [];
          obj.artifacts = [];
        }
        if (version < 4) {
          // stjerneengen no longer exists in the type — cast through
          // string for the rewrite. Any persisted key-id that was
          // 'stjerneengen' becomes 'blod' (the chain successor).
          const k = (obj.keys as string[] | undefined) ?? [];
          obj.keys = k.map((r) => (r === 'stjerneengen' ? 'blod' : r)) as RegionId[];
        }
        return obj as unknown as GameState;
      },
    },
  ),
);
