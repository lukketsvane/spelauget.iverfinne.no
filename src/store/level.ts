import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  findPlayerSpawn,
  LEVELS,
  WORLD_SPAWN_POINTS,
} from '@/game/levels';
import { getRegion, regionAt, REGIONS, type RegionId } from '@/game/regions';
import { useDialogue } from '@/store/dialogue';
import { useInput } from '@/store/input';
import { useToast } from '@/store/toast';

// One mega-map: the level itself never changes. What used to be
// "teleport to another level" is now "fast-travel to a region's
// waypoint inside the same world": same cinematic fade timeline,
// same store API surface, but the player just gets relocated.
//
// `currentRegionId` is recomputed from the player's world position
// on each savePosition tick, plus once on rehydrate, so the menu's
// Travel buttons and the day/night toast can refer to where the
// player actually is.

const FADE_MS = 1400;
const PROXIMITY_DISCOVERY_DIST = 18; // metres

type LevelState = {
  // Always 'world' since the multi-level concept collapsed; kept on
  // the store so Scene.tsx + Spawns.tsx don't have to care.
  currentLevelId: 'world';
  // World-space spawn point for fresh sessions / the next teleport.
  // Updated on travel(), reset, and rehydrate (fed by savedPosition
  // when present).
  playerSpawn: { x: number; z: number };
  // Bumps every time the player gets relocated. Character.tsx watches
  // it to reset its group transform to the new spawn.
  changeCounter: number;
  // Two-phase fade for fast-travel: 'idle' | 'out' | 'in'.
  transitionPhase: 'idle' | 'out' | 'in';
  // Latest player world-space position. Persisted so reload / Continue
  // puts the character back exactly where they left off rather than
  // at the world spawn marker.
  savedPosition: { x: number; z: number } | null;
  // Region the player is currently inside (highest Gaussian weight at
  // their position). Refreshed on each savePosition tick.
  currentRegionId: RegionId;
  // Set of region ids the player has visited or fast-travelled to.
  // Populated on entry-via-proximity (savePosition) and on travel().
  // Persisted across sessions; powers the menu's Travel list.
  discoveredWaypoints: RegionId[];
  // Cinematic fast-travel: fade-to-black, relocate player, fade-back.
  travel: (target: RegionId) => void;
  // Hard reset to a fresh game on the world spawn. Used by New Game.
  reset: () => void;
  // Throttled autosave: Character calls this every couple seconds.
  savePosition: (x: number, z: number) => void;
};

function addDiscovered(list: RegionId[], id: RegionId): RegionId[] {
  return list.includes(id) ? list : [...list, id];
}

export const useLevel = create<LevelState>()(
  persist(
    (set, get) => ({
      currentLevelId: 'world',
      playerSpawn: findPlayerSpawn(LEVELS.world),
      changeCounter: 0,
      transitionPhase: 'idle',
      savedPosition: null,
      currentRegionId: regionAt(0, 0).id,
      discoveredWaypoints: ['lysningen'],
      travel: (target) => {
        if (get().transitionPhase !== 'idle') return;

        // Halt any walk-in-progress so the player doesn't slide off
        // their new spawn the instant the world reappears.
        const input = useInput.getState();
        input.setMove(0, 0);
        input.clearDestination();
        // Close any active dialogue — a conversation in the old
        // region doesn't make sense once the world fades back in
        // somewhere else.
        if (useDialogue.getState().active) useDialogue.getState().close();

        set({ transitionPhase: 'out' });
        setTimeout(() => {
          const region = getRegion(target);
          // Per-world spawn points let Hageverden keep its world-origin
          // spawn while empty worlds drop the player at their region
          // centre.
          const spawn = WORLD_SPAWN_POINTS[region.id] ?? {
            x: region.center[0],
            z: region.center[1],
          };
          set((s) => ({
            playerSpawn: spawn,
            changeCounter: s.changeCounter + 1,
            transitionPhase: 'in',
            savedPosition: null,
            currentRegionId: region.id,
            discoveredWaypoints: addDiscovered(s.discoveredWaypoints, region.id),
          }));
          useToast.getState().push(region.name);
          setTimeout(() => {
            set({ transitionPhase: 'idle' });
          }, FADE_MS);
        }, FADE_MS);
      },
      reset: () =>
        set((s) => ({
          playerSpawn: findPlayerSpawn(LEVELS.world),
          changeCounter: s.changeCounter + 1,
          transitionPhase: 'idle',
          savedPosition: null,
          currentRegionId: regionAt(0, 0).id,
          discoveredWaypoints: ['lysningen'],
        })),
      savePosition: (x, z) => {
        if (get().transitionPhase !== 'idle') return;
        const cur = get().savedPosition;
        const region = regionAt(x, z);
        const stateUpdates: Partial<LevelState> = {};
        // Skip near-identical position writes so we don't burn
        // localStorage bandwidth when standing still — but still let
        // region updates propagate.
        if (!cur || Math.hypot(cur.x - x, cur.z - z) >= 0.05) {
          stateUpdates.savedPosition = { x, z };
        }
        // Region ID + discovery via proximity: the player only earns
        // a Travel waypoint by getting reasonably close to a region
        // centre (not just by glancing the gradient blob's edge).
        if (region.id !== get().currentRegionId) {
          stateUpdates.currentRegionId = region.id;
        }
        const dx = x - region.center[0];
        const dz = z - region.center[1];
        if (Math.hypot(dx, dz) < PROXIMITY_DISCOVERY_DIST) {
          const list = get().discoveredWaypoints;
          if (!list.includes(region.id)) {
            stateUpdates.discoveredWaypoints = addDiscovered(list, region.id);
            // Surface the discovery as a toast — feels like a TotK
            // waypoint reveal.
            useToast.getState().push(`Discovered: ${region.name}`, 'success');
          }
        }
        if (Object.keys(stateUpdates).length > 0) set(stateUpdates as LevelState);
      },
    }),
    {
      name: 'spelauget.level',
      version: 5,
      partialize: (s) => ({
        savedPosition: s.savedPosition,
        currentRegionId: s.currentRegionId,
        discoveredWaypoints: s.discoveredWaypoints,
      }),
      // v3 → v4: collapse the multi-level model into a single shared
      //   world. currentLevelId is dropped; old discoveredLevels gets
      //   mapped to its region equivalent.
      // v4 → v5: stjerneengen was removed entirely. Any persisted
      //   currentRegionId / discoveredWaypoints entry of
      //   'stjerneengen' rewrites to 'blod' so the player still has
      //   somewhere to be / travel to after the upgrade.
      migrate: (persistedState, version) => {
        type Persisted = {
          savedPosition: { x: number; z: number } | null;
          currentRegionId: RegionId;
          discoveredWaypoints: RegionId[];
        };
        if (!persistedState || typeof persistedState !== 'object') {
          return persistedState as Persisted;
        }

        const obj = persistedState as Record<string, unknown>;

        if (version < 4) {
          // Old discoveredLevels used the level1/2/3 ids.
          const oldDiscovered = (obj.discoveredLevels as string[] | undefined) ?? [
            'level1',
          ];
          // level2 used to map to 'stjerneengen'; that region is gone,
          // so stride straight to 'blod' (the chain successor).
          const map: Record<string, RegionId> = {
            level1: 'lysningen',
            level2: 'blod',
            level3: 'remnants',
          };
          const seedSet = new Set<RegionId>(['lysningen']);
          for (const id of oldDiscovered) {
            const r = map[id];
            if (r) seedSet.add(r);
          }
          obj.savedPosition = null;
          obj.currentRegionId = 'lysningen';
          obj.discoveredWaypoints = [...seedSet];
        }

        if (version < 5) {
          // Rewrite stale 'stjerneengen' refs to 'blod'.
          const cur = obj.currentRegionId as string | undefined;
          if (cur === 'stjerneengen') obj.currentRegionId = 'blod';
          const dw = (obj.discoveredWaypoints as string[] | undefined) ?? [];
          obj.discoveredWaypoints = dw.map((d) =>
            d === 'stjerneengen' ? 'blod' : d,
          );
        }

        return obj as unknown as Persisted;
      },
      onRehydrateStorage: () => (state) => {
        if (state) {
          // Reseed playerSpawn from savedPosition if present, else use
          // the world spawn (Lysningen centre). transitionPhase is
          // never persisted so we always land in 'idle'.
          const def = LEVELS.world;
          state.playerSpawn = state.savedPosition ?? findPlayerSpawn(def);
          state.transitionPhase = 'idle';
          // Drop any discovered ids that no longer exist in the build
          // (renamed regions).
          const known = state.discoveredWaypoints ?? ['lysningen'];
          const validIds = new Set<RegionId>(REGIONS.map((r) => r.id));
          state.discoveredWaypoints = known.filter((d) => validIds.has(d));
          if (!state.discoveredWaypoints.includes('lysningen')) {
            state.discoveredWaypoints = ['lysningen', ...state.discoveredWaypoints];
          }
          // Recompute currentRegionId from the actual rehydrated
          // position so the HUD label is right on first frame.
          if (state.savedPosition) {
            state.currentRegionId = regionAt(
              state.savedPosition.x,
              state.savedPosition.z,
            ).id;
          }
        }
      },
    },
  ),
);
