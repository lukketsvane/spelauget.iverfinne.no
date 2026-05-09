import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { findPlayerSpawn, LEVELS, type LevelId } from '@/game/levels';

type LevelState = {
  currentLevelId: LevelId;
  // Updated whenever the level changes — Character watches this and
  // teleports its group to (x, 0, z).
  playerSpawn: { x: number; z: number };
  // Increments on every level change. Components subscribe to this for
  // reset effects (NPC dialogue state, interaction claims).
  changeCounter: number;
  setLevel: (id: LevelId) => void;
};

// Persisted across reloads via localStorage. We keep methods + derived
// values out of storage and recompute them on rehydration so the store
// is always self-consistent even after schema changes.
export const useLevel = create<LevelState>()(
  persist(
    (set) => ({
      currentLevelId: 'level1',
      playerSpawn: findPlayerSpawn(LEVELS.level1),
      changeCounter: 0,
      setLevel: (id) =>
        set((s) => ({
          currentLevelId: id,
          playerSpawn: findPlayerSpawn(LEVELS[id]),
          changeCounter: s.changeCounter + 1,
        })),
    }),
    {
      name: 'spelauget.level',
      version: 1,
      partialize: (s) => ({ currentLevelId: s.currentLevelId }),
      onRehydrateStorage: () => (state) => {
        // Recompute playerSpawn from the rehydrated currentLevelId so
        // teleports go to the right marker if level data changed.
        if (state) {
          const id = state.currentLevelId;
          if (LEVELS[id]) {
            state.playerSpawn = findPlayerSpawn(LEVELS[id]);
          } else {
            state.currentLevelId = 'level1';
            state.playerSpawn = findPlayerSpawn(LEVELS.level1);
          }
        }
      },
    },
  ),
);
