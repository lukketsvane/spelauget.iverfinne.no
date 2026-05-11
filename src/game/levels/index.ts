// Levels aggregator. Keeps the public surface compatible with the
// pre-refactor `@/game/levels` import path: re-exports types,
// LEVELS / findPlayerSpawn, plus the new per-world WORLD_SPAWNS map
// + WORLD_SPAWN_POINTS map that Spawns.tsx and the level store read.
//
// Adding a new world: drop a sibling folder under /levels with an
// index.ts exporting <NAME>_SPAWNS + <NAME>_SPAWN_POINT, then list
// it in WORLD_SPAWNS / WORLD_SPAWN_POINTS below.

import type { RegionId } from '../regions';
import { BLODVERDEN_SPAWNS, BLODVERDEN_SPAWN_POINT } from './blodverden';
import { FLISVERDEN_SPAWNS, FLISVERDEN_SPAWN_POINT } from './flisverden';
import { HAGEN_SPAWNS, HAGEN_SPAWN_POINT } from './hagen';
import { SALTVERDEN_SPAWNS, SALTVERDEN_SPAWN_POINT } from './saltverden';
import { SPEILVERDEN_SPAWNS, SPEILVERDEN_SPAWN_POINT } from './speilverden';
import type { LevelDefinition, Spawn } from './types';

export * from './types';

// Per-region spawn arrays. Spawns.tsx reads
// WORLD_SPAWNS[currentRegionId] each render, so changing region
// remounts the props for the new world and unmounts the old.
//
// `remnants` is intentionally empty — it survives in REGIONS only as
// a legacy gradient row, not as a destination. (The pause-menu
// Travel list filters it out via CHAIN_REGION_IDS.)
export const WORLD_SPAWNS: Record<RegionId, Spawn[]> = {
  lysningen: HAGEN_SPAWNS,
  blod: BLODVERDEN_SPAWNS,
  geometri: FLISVERDEN_SPAWNS,
  siste: SALTVERDEN_SPAWNS,
  senter: SPEILVERDEN_SPAWNS,
  remnants: [],
};

// Per-region spawn POINTS — where the player physically appears on
// arrival. Hagen overrides region centre with world origin so the
// existing per-prop layout still frames correctly; the others use
// their region centre directly.
export const WORLD_SPAWN_POINTS: Record<RegionId, { x: number; z: number }> = {
  lysningen: HAGEN_SPAWN_POINT,
  blod: BLODVERDEN_SPAWN_POINT,
  geometri: FLISVERDEN_SPAWN_POINT,
  siste: SALTVERDEN_SPAWN_POINT,
  senter: SPEILVERDEN_SPAWN_POINT,
  remnants: { x: 0, z: 90 },
};

// Legacy single-level shim. `LEVELS.world.spawns` returns Hagen's
// content as a default — callers that still want the "everything in
// one bucket" view get Hagen since that's the authored world. Newer
// code should read WORLD_SPAWNS[regionId] instead.
export const LEVELS: Record<'world', LevelDefinition> = {
  world: {
    id: 'world',
    name: 'The World',
    playerSpawn: HAGEN_SPAWN_POINT,
    spawns: HAGEN_SPAWNS,
  },
};

export function findPlayerSpawn(level: LevelDefinition): { x: number; z: number } {
  return level.playerSpawn;
}
