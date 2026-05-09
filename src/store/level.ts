import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { findPlayerSpawn, LEVELS, type LevelId } from '@/game/levels';
import { useInput } from '@/store/input';
import { useToast } from '@/store/toast';

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
  // Latest player world-space position. Persisted (along with
  // currentLevelId) so reload / Continue puts the character back
  // exactly where they left off rather than at the level's static
  // spawn marker. Reset on level change, New Game, and reset().
  savedPosition: { x: number; z: number } | null;
  setLevel: (id: LevelId) => void;
  // Cinematic teleport: fade-to-black, swap, fade-from-black.
  teleport: (id: LevelId) => void;
  // Hard reset to a fresh game on level1. Used by the New Game button.
  reset: () => void;
  // Throttled autosave: Character calls this every couple seconds.
  savePosition: (x: number, z: number) => void;
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
      savedPosition: null,
      setLevel: (id) =>
        set((s) => ({
          currentLevelId: id,
          playerSpawn: findPlayerSpawn(LEVELS[id]),
          changeCounter: s.changeCounter + 1,
          // Entering a new level → discard the saved position from the
          // old level so the spawn marker is honoured. The next
          // savePosition() tick will start tracking again.
          savedPosition: null,
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
            savedPosition: null,
          }));
          // Announce the new level once the player is in it. Fired at
          // the swap point so it appears just as the fade-from-black
          // begins — feels timed with the reveal.
          useToast.getState().push(LEVELS[id].name);
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
          savedPosition: null,
        })),
      savePosition: (x, z) => {
        // Skip writes during a teleport — the position momentarily
        // sits at the new level's spawn marker and we don't want
        // a half-baked frame to overwrite it.
        if (get().transitionPhase !== 'idle') return;
        const cur = get().savedPosition;
        // Skip near-identical writes so we don't burn localStorage
        // bandwidth when the player is standing still.
        if (cur && Math.hypot(cur.x - x, cur.z - z) < 0.05) return;
        set({ savedPosition: { x, z } });
      },
    }),
    {
      name: 'spelauget.level',
      version: 2,
      partialize: (s) => ({
        currentLevelId: s.currentLevelId,
        savedPosition: s.savedPosition,
      }),
      // v1 → v2: forward-port currentLevelId, default savedPosition to
      // null so an existing save lands the player on the level marker
      // rather than at world origin. Without a migrate, zustand drops
      // v1 data entirely and the player loses their level on first run.
      migrate: (persistedState, version) => {
        if (version < 2 && persistedState && typeof persistedState === 'object') {
          const prev = persistedState as { currentLevelId?: LevelId };
          return {
            currentLevelId: prev.currentLevelId ?? 'level1',
            savedPosition: null,
          };
        }
        return persistedState as { currentLevelId: LevelId; savedPosition: { x: number; z: number } | null };
      },
      onRehydrateStorage: () => (state) => {
        // Recompute playerSpawn from the rehydrated currentLevelId so
        // teleports go to the right marker if level data changed. If a
        // savedPosition was persisted, use it as the spawn so Continue /
        // reload puts the character exactly where they left off — the
        // "exact savegame" behaviour. Falls back to the level marker
        // when no save exists yet (first launch, fresh New Game).
        if (state) {
          const id = state.currentLevelId;
          if (!LEVELS[id]) {
            state.currentLevelId = 'level1';
            state.savedPosition = null;
          }
          const def = LEVELS[state.currentLevelId];
          state.playerSpawn = state.savedPosition ?? findPlayerSpawn(def);
          state.transitionPhase = 'idle';
        }
      },
    },
  ),
);
