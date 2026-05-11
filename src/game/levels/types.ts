// Spawn type definitions — one Spawn variant per kind of thing the
// per-world spawn arrays can contain. Lives at /levels/types.ts so
// every per-world file (hageverden/index.ts, blodverden/index.ts, …) can
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
  | 'tangled_root_sculpture'
  | 'mythical_horse';

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

// Flisverden block-out asset. Loads one of the four GLB blueprints
// exported from Blender (`/flisverden_models/flis_<kind>.glb`) and
// places it at world coords. Registers a mesh-derived collider so
// the player walks around the silhouette, except for `tile` which
// is the flat ground plane (passable).
export type FlisPropKind = 'figure_seated' | 'vesica' | 'pillar' | 'floor_tile';
export type FlisPropSpawn = {
  kind: 'flis_prop';
  id: string;
  position: [number, number];
  // Which exported asset to load. Maps 1:1 to a file in
  // /public/flisverden_models/.
  prop: FlisPropKind;
  scale?: number;
  rotation?: number;
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

// Hot-pink monumental figure (giantess_squat.glb) — sits/squats around
// scenery. Pure prop with a circle collider so the player walks around
// its silhouette. `yOffset` perches the figure on top of a raised
// structure (e.g. the pool deck), since the world is otherwise flat
// and the spawn position is XZ only.
export type GiantessSpawn = {
  kind: 'giantess';
  id: string;
  position: [number, number];
  yOffset?: number;
  scale?: number;
  rotation?: number;
  color?: string;
  emissive?: string;
  emissiveIntensity?: number;
};

// Composite swimming-pool prop: U-shaped tile-cube wall around a
// recessed water basin. Single spawn = whole assembly. Rotation pivots
// the open south side to wherever the level designer wants the player
// to enter.
export type FlisPoolSpawn = {
  kind: 'flis_pool';
  id: string;
  position: [number, number];
  rotation?: number;
  scale?: number;
};

// Painted-card sprite for the blodverden asset family. Source PNG has
// a black background that the shader maps to alpha; the silhouette /
// coloured shape is preserved verbatim. Use for plants, creatures,
// moths, portals, monuments — anything 2D in Blodverden.
export type BlodSpriteSpawn = {
  kind: 'blod_sprite';
  id: string;
  position: [number, number];
  texture: string;
  height?: number;
  scale?: number;
  rotationOffset?: number;
  noCollide?: boolean;
  yOffset?: number;
  glow?: number;
  tint?: string;
};

// Perfect-mirror floor plane for Kjellerverden. Uses THREE.Reflector
// to render the scene from the mirrored viewpoint into a texture and
// sample it on the plane — a true mirror, not an env map fake.
export type KjellerMirrorSpawn = {
  kind: 'kjeller_mirror';
  id: string;
  position: [number, number];
  width?: number;
  depth?: number;
  color?: string;
  resolution?: number;
};

// Flat tile-textured deck plane — drop one (or several) into a world
// to pave the ground around the pool with the same wet ceramic tiles.
// No collider; it's a visual surface only.
export type FlisFloorSpawn = {
  kind: 'flis_floor';
  id: string;
  position: [number, number];
  width: number;
  depth: number;
  tileSize?: number;
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
  | FlisPropSpawn
  | SkateSpawn
  | GiantessSpawn
  | FlisPoolSpawn
  | FlisFloorSpawn
  | BlodSpriteSpawn
  | KjellerMirrorSpawn;

export type LevelDefinition = {
  id: LevelId;
  name: string;
  playerSpawn: { x: number; z: number };
  spawns: Spawn[];
};
