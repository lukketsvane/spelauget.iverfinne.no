// Spawn type definitions — one Spawn variant per kind of thing the
// per-world spawn arrays can contain. Lives at /levels/types.ts so
// every per-world file (hagen/index.ts, blodverden/index.ts, …) can
// import these without pulling in the full LEVELS aggregator.

import type { DialogueLine } from '@/store/dialogue';
import type { RegionId } from '../regions';

// Single-level shim left in place for any code that still reads
// `useLevel.currentLevelId` — it's always 'world' regardless of the
// per-world spawn switch the runtime now does.
export type LevelId = 'world';

export type StarNpcSpawn = {
  kind: 'star_npc';
  id: string;
  position: [number, number]; // [x, z]
  dialogue: DialogueLine[];
};

export type BobleNpcSpawn = {
  kind: 'boble_npc';
  id: string;
  position: [number, number];
  dialogue: DialogueLine[];
  leadTo?: [number, number];
};

export type PortalSpawn = {
  kind: 'portal';
  id: string;
  position: [number, number];
  targetRegion: RegionId;
  colorA?: string;
  colorB?: string;
  // RegionId of the key that unlocks this portal. Omit for the legacy
  // any-key behaviour. For the world chain, set this to the same
  // value as `targetRegion` so the key found in world N opens the
  // portal that leads to world N (or pick a custom mapping per
  // design).
  requiredKey?: RegionId;
  // Optional painted-card art for the portal (additive blend → black
  // backgrounds become transparent). When unset, the swirling shader
  // disc is the entire visual.
  texture?: string;
  // World-space height of the painted card. Width derives from
  // texture aspect. Defaults to 6 m so the arch reads as
  // walk-through-able.
  height?: number;
};

export type StoneHutSpawn = {
  kind: 'stone_hut';
  id: string;
  position: [number, number];
  scale?: number;
  rotation?: number;
};

export type RockStackSpawn = {
  kind: 'rock_stack';
  id: string;
  position: [number, number];
  scale?: number;
  rotation?: number;
};

export type TriloSpawn = {
  kind: 'trilo';
  id: string;
  position: [number, number];
  scale?: number;
  rotation?: number;
  color?: string;
  emissive?: string;
};

export type RelicSpawn = {
  kind: 'relic';
  id: string;
  position: [number, number];
  texture: string;
  height?: number;
  scale?: number;
};

export type CarSpawn = {
  kind: 'car';
  id: string;
  position: [number, number];
  scale?: number;
  rotation?: number;
  model?: 'car_01' | 'car_02';
};

export type CarPortalSpawn = {
  kind: 'car_portal';
  id: string;
  position: [number, number];
  scale?: number;
  rotation?: number;
  targetRegion: RegionId;
  // 'bobbleVanished' — needs Bobble led to it; 'hasKey' — any-key
  // legacy check; `key:<region>` — needs that specific portal-key.
  gate?: 'bobbleVanished' | 'hasKey' | `key:${RegionId}`;
};

export type RemnantSpawn = {
  kind: 'remnant';
  id: string;
  position: [number, number];
  texture: string;
  height?: number;
  scale?: number;
  rotationOffset?: number;
};

export type SceneryKind =
  | 'glowing_purple_coral'
  | 'neon_vascular_tree'
  | 'purple_coral'
  | 'purple_coral_alt'
  | 'purple_stone_cairn'
  | 'tangled_root_sculpture';

export type ScenerySpawn = {
  kind: SceneryKind;
  id: string;
  position: [number, number];
  scale?: number;
  rotation?: number;
};

export type CrystalSpawn = {
  kind: 'crystal';
  id: string;
  position: [number, number];
};

export type CrystalAltarSpawn = {
  kind: 'crystal_altar';
  id: string;
  position: [number, number];
  scale?: number;
  rotation?: number;
};

// Per-portal key pickup. Visible, obvious — adds `opens` to
// useGame.keys on pickup, which unlocks any portal whose
// `requiredKey === opens`.
export type KeySpawn = {
  kind: 'key';
  id: string;
  position: [number, number];
  opens: RegionId;
};

// Hidden, optional collectible — one per outer world. Adds `region`
// to useGame.artifacts on pickup. The mandala ending in `senter`
// reads the artifact set as a bitmask to pick among the possible
// configurations.
export type ArtifactSpawn = {
  kind: 'artifact';
  id: string;
  position: [number, number];
  region: RegionId;
};

// Stingray-style ambient creature that orbits a fixed world-space
// centre on a horizontal circle. Pure decoration — no collision,
// dialogue, or interaction.
export type SkateSpawn = {
  kind: 'skate';
  id: string;
  position: [number, number];
  radius: number;
  height: number;
  period: number;
  scale?: number;
  phase?: number;
};

export type Spawn =
  | StarNpcSpawn
  | BobleNpcSpawn
  | PortalSpawn
  | StoneHutSpawn
  | RockStackSpawn
  | TriloSpawn
  | RelicSpawn
  | CarSpawn
  | CarPortalSpawn
  | RemnantSpawn
  | ScenerySpawn
  | CrystalSpawn
  | CrystalAltarSpawn
  | KeySpawn
  | ArtifactSpawn
  | SkateSpawn;

export type LevelDefinition = {
  id: LevelId;
  name: string;
  playerSpawn: { x: number; z: number };
  spawns: Spawn[];
};
