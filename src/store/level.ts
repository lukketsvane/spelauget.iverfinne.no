import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { findPlayerSpawn, LEVELS, type LevelId } from '@/game/levels';
import { useInput } from '@/store/input';

// Half the total fade time. The full transition is FADE_MS * 2 — black
// fades IN for FADE_MS, the level swaps, then black fades OUT for
// another FADE_MS while the new level renders behind the overlay.
const FADE_MS = 1400;

type LevelState = {
  currentLevelId: LevelId;
  // Updated whenever the level changes — Character watches this and
  // teleports its group to (x, 0, z).
  playerSpawn: { x: number; z: number };
  // Increments on every level change. Components subscribe to this for
  // reset effects (NPC dialogue state, interaction claims).
  changeCounter: number;
  // Two-phase fade for portal teleports:
  //   'idle' → no overlay
  //   'out'  → black fading in (covering screen)
  //   'in'   → black fading out (revealing new level)
  transitionPhase: 'idle' | 'out' | 'in';
  setLevel: (id: LevelId) => void;
  // Cinematic teleport: fade-to-black, swap, fade-from-black.
  teleport: (id: LevelId) => void;
  // Hard reset to a fresh game on level1. Used by the New Game button.
  reset: () => void;
};

// Persisted across reloads via localStorage. We keep methods + derived
// values out of storage and recompute them on rehydration so the store
// is always self-consistent even after schema changes.
export const useLevel = create<LevelState>()(
  persist(
    (set, get) => ({
      currentLevelId: 'level1',
      playerSpawn: findPlayerSpawn(LEVELS.level1),
      changeCounter: 0,
      transitionPhase: 'idle',
      setLevel: (id) =>
        set((s) => ({
          currentLevelId: id,
          playerSpawn: findPlayerSpawn(LEVELS[id]),
          changeCounter: s.changeCounter + 1,
        })),
      teleport: (id) => {
        // Already mid-transition? Ignore — second portal trigger
        // shouldn't restart the timeline or chain swaps.
        if (get().transitionPhase !== 'idle') return;

        // Stop any walk-in-progress so the player doesn't slide off
        // their new spawn the instant the world reappears.
        const input = useInput.getState();
        input.setMove(0, 0);
        input.clearDestination();

        // Phase 1: fade overlay from 0 → 1 (covering screen).
        set({ transitionPhase: 'out' });
        setTimeout(() => {
          // Mid-fade: the screen is fully black, swap level invisibly.
          set((s) => ({
            currentLevelId: id,
            playerSpawn: findPlayerSpawn(LEVELS[id]),
            changeCounter: s.changeCounter + 1,
            transitionPhase: 'in',
          }));
          // Phase 2: fade overlay from 1 → 0 (revealing new world).
          setTimeout(() => {
            set({ transitionPhase: 'idle' });
          }, FADE_MS);
        }, FADE_MS);
      },
      reset: () =>
        set((s) => ({
          currentLevelId: 'level1',
          playerSpawn: findPlayerSpawn(LEVELS.level1),
          changeCounter: s.changeCounter + 1,
          transitionPhase: 'idle',
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
