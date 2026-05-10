// One mega-map. Every NPC, prop, decorative GLB and portal lives in a
// single shared coordinate space. Regions (palettes + waypoint
// names) come from regions.ts; the only thing this file owns is the
// flat list of spawns plus the Spawn type union that Spawns.tsx
// dispatches on.
//
// `LevelId` is preserved as a single `'world'` value so the rest of
// the codebase (useLevel, the Travel UI, the persisted save) doesn't
// need to be aware that the multi-level concept has collapsed.
//
// Adding a new spawn kind:
//   1. Add the variant to the Spawn union below.
//   2. Add a case in Spawns.tsx that mounts the matching component.
//
// Coordinates are world-space metres. Positive X = east, positive Z
// = south. Region centres (see regions.ts) act as anchor points for
// each cluster of spawns.

import type { DialogueLine } from '@/store/dialogue';
import type { RegionId } from './regions';

// Single-level shim: useLevel still tracks `currentLevelId`, but it's
// always 'world' now. Region names live next to spawn coordinates;
// fast-travel within the same world hits region waypoints.
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
  // Optional [x, z] in world space. After dialogue, Bobble follows the
  // player. Once Bobble + the player both reach this point, Bobble
  // fades out and `useGame.bobbleVanished` flips, unlocking whatever
  // is gated on that flag (the parked car, in our case).
  leadTo?: [number, number];
};

// Inter-region fast-travel portal. Bowing within range fades to black,
// translates the player to the target region's waypoint centre, then
// fades back in. Same cinematic timeline the old inter-level teleports
// used.
export type PortalSpawn = {
  kind: 'portal';
  id: string;
  position: [number, number];
  targetRegion: RegionId;
  colorA?: string;
  colorB?: string;
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
};

// Car that doubles as a portal once a game flag flips.
export type CarPortalSpawn = {
  kind: 'car_portal';
  id: string;
  position: [number, number];
  scale?: number;
  rotation?: number;
  targetRegion: RegionId;
  gate?: 'bobbleVanished' | 'hasKey';
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

// New-asset GLB scenery — six chunky natural props the user
// authored. Rendered with a generic StaticGLB component (see
// Spawns.tsx) that derives a tight collider from the actual mesh
// bounds. Materials get tinted by the in-world position-blended
// gradient just like the GLB props that came before them.
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
  | ScenerySpawn;

export type LevelDefinition = {
  id: LevelId;
  name: string;
  // Initial player spawn for a fresh New Game. Travel / portals
  // override this at runtime; useLevel.savedPosition wins on Continue.
  playerSpawn: { x: number; z: number };
  spawns: Spawn[];
};

// Region-centred coordinate helpers. Each region's spawns are
// expressed as offsets from its centre so the layout stays readable
// even when the centres move in regions.ts.
const LYS = (x: number, z: number): [number, number] => [x, z];
const STJ = (x: number, z: number): [number, number] => [70 + x, -15 + z];
const REM = (x: number, z: number): [number, number] => [30 + x, 75 + z];

export const LEVELS: Record<LevelId, LevelDefinition> = {
  world: {
    id: 'world',
    name: 'The Clearing',
    playerSpawn: { x: 0, z: 0 },
    spawns: [
      // ===================================================================
      // === Lysningen — The Clearing (region centre: 0, 0) ================
      // ===================================================================
      { kind: 'stone_hut', id: 'l1.hut.center', position: LYS(0, -16) },
      { kind: 'rock_stack', id: 'l1.rock.south', position: LYS(0, 8) },
      {
        kind: 'star_npc',
        id: 'l1.star.welcome',
        position: LYS(-4, -8),
        dialogue: [
          { text: 'Stand still for a moment.' },
          {
            text: "Do you hear it? Under the earth. I'm not the one making that sound. I've lain here for three days listening, and I'm fairly sure now.",
          },
          {
            text: 'There is someone breathing down there. Or someone speaking, slowly, as if they forget the words between each one.',
          },
          { action: true, text: 'reaches something out through the soil' },
          {
            text: "Here. It wasn't mine. I found it beneath a stone that wouldn't move, until it suddenly would. You shouldn't trust stones like that, but you can trust keys. Keys only want one thing.",
          },
          {
            text: 'Carry it all the way in. All, all the way in. To where the clearing stops being a clearing.',
          },
          {
            text: "And, if you meet a car parked where no car should be parked: walk around. Don't look inside.",
          },
        ],
      },
      // Portal at the eastern edge of Lysningen → fast-travel to
      // Stjerneengen. Gated on the player having the key.
      {
        kind: 'portal',
        id: 'l1.portal.to.stjerneengen',
        position: LYS(12, 16),
        targetRegion: 'stjerneengen',
      },
      // Scenery for Lysningen — a few of the new natural GLBs to
      // give the region its own silhouette language.
      { kind: 'purple_coral', id: 'l1.coral.a', position: LYS(-10, -2), scale: 1.6 },
      { kind: 'purple_coral_alt', id: 'l1.coral.b', position: LYS(8, 4), scale: 1.4, rotation: 0.6 },
      { kind: 'glowing_purple_coral', id: 'l1.coral.c', position: LYS(-14, 10), scale: 1.2 },
      {
        kind: 'tangled_root_sculpture',
        id: 'l1.roots.a',
        position: LYS(6, -12),
        scale: 1.3,
        rotation: -0.3,
      },
      {
        kind: 'purple_stone_cairn',
        id: 'l1.cairn.a',
        position: LYS(-6, 14),
        scale: 1.3,
        rotation: 0.2,
      },

      // ===================================================================
      // === Stjerneengen — The Star Meadow (region centre: 70, -15) =======
      // ===================================================================
      // Return portal back to Lysningen.
      {
        kind: 'portal',
        id: 'l2.portal.to.lysningen',
        position: STJ(-12, -5),
        targetRegion: 'lysningen',
        colorA: '#a4d8ff',
        colorB: '#3a4cff',
      },
      { kind: 'stone_hut', id: 'l2.hut.west', position: STJ(-12, 4), rotation: 0.3 },
      { kind: 'stone_hut', id: 'l2.hut.east', position: STJ(12, 4), rotation: -0.4 },
      { kind: 'rock_stack', id: 'l2.rock.center', position: STJ(0, 8) },
      {
        kind: 'boble_npc',
        id: 'l2.boble.bobble',
        position: STJ(8, -8),
        // Lead Bobble to the parked car. Once Bobble and the player
        // both stand within ~4.5 m of this point, Bobble fades out
        // and `useGame.bobbleVanished` flips, unlocking the car.
        leadTo: STJ(0, -16),
        dialogue: [
          { text: 'Oh, a fresh face. The lights felt it before I did.' },
          { text: "I'm Bobble. I don't have legs. Just opinions, and wind." },
          { action: true, text: 'tilts, drifts a hand-width sideways, drifts back' },
          {
            text: 'So the digger gave you the key. They give it to most. I never asked why.',
          },
          {
            text: "There's a car not far from here. The digger told you to walk past. I think you should look.",
          },
          {
            text: "Take me to it. I'll keep close. When we're there, I won't be of any more use to you.",
          },
          { text: "Don't worry about me after. Just open the door." },
        ],
      },
      {
        kind: 'relic',
        id: 'l2.relic.north',
        position: STJ(-2, -22),
        texture: '/relic1%201.png',
        height: 5.5,
      },
      {
        kind: 'relic',
        id: 'l2.relic.east',
        position: STJ(22, 6),
        texture: '/relic3%201.png',
        height: 6,
      },
      {
        kind: 'relic',
        id: 'l2.relic.south',
        position: STJ(-4, 24),
        texture: '/relic2%201.png',
        height: 4,
      },
      {
        kind: 'relic',
        id: 'l2.relic.far-west',
        position: STJ(-22, 16),
        texture: '/relic4%201.png',
        height: 4,
      },
      // The car the digger warned about — short walk south of Bobble.
      // Becomes interactable as a portal to The Remnants once the
      // player has led Bobble here. Until then it's just a collidable
      // static prop.
      {
        kind: 'car_portal',
        id: 'l2.car.parked',
        position: STJ(0, -16),
        rotation: 0.6,
        targetRegion: 'remnants',
        gate: 'bobbleVanished',
      },
      {
        kind: 'trilo',
        id: 'l2.trilo.north-west',
        position: STJ(-6, -12),
        scale: 1.6,
        rotation: 0.8,
        color: '#3d99a8',
        emissive: '#0a2a3a',
      },
      {
        kind: 'trilo',
        id: 'l2.trilo.east',
        position: STJ(16, 0),
        scale: 2.0,
        rotation: -1.2,
        color: '#4ec0c5',
        emissive: '#0c3340',
      },
      {
        kind: 'trilo',
        id: 'l2.trilo.south',
        position: STJ(-4, 20),
        scale: 1.4,
        rotation: 2.1,
        color: '#5fa8d0',
        emissive: '#10283a',
      },
      // Stjerneengen scenery — vascular tree + a coral cluster.
      {
        kind: 'neon_vascular_tree',
        id: 'l2.tree.a',
        position: STJ(-14, -4),
        scale: 1.4,
        rotation: 0.4,
      },
      {
        kind: 'glowing_purple_coral',
        id: 'l2.coral.a',
        position: STJ(18, -10),
        scale: 1.2,
      },
      {
        kind: 'tangled_root_sculpture',
        id: 'l2.roots.a',
        position: STJ(-18, 10),
        scale: 1.5,
        rotation: 1.1,
      },

      // ===================================================================
      // === The Remnants (region centre: 30, 75) ==========================
      // ===================================================================
      {
        kind: 'portal',
        id: 'l3.portal.back',
        position: REM(0, 14),
        targetRegion: 'stjerneengen',
        colorA: '#cdd2dc',
        colorB: '#3b414e',
      },
      {
        kind: 'remnant',
        id: 'l3.remnant.01',
        position: REM(-10, -6),
        texture: '/remnants/remnant_01.png',
        height: 5.5,
        rotationOffset: -0.3,
      },
      {
        kind: 'remnant',
        id: 'l3.remnant.02',
        position: REM(12, -10),
        texture: '/remnants/remnant_02.png',
        height: 4.5,
        rotationOffset: 0.4,
      },
      {
        kind: 'remnant',
        id: 'l3.remnant.03',
        position: REM(-14, 6),
        texture: '/remnants/remnant_03.png',
        height: 6,
        rotationOffset: -0.15,
      },
      {
        kind: 'remnant',
        id: 'l3.remnant.04',
        position: REM(8, 8),
        texture: '/remnants/remnant_04.png',
        height: 5,
        rotationOffset: 0.25,
      },
      {
        kind: 'remnant',
        id: 'l3.remnant.05',
        position: REM(-4, -16),
        texture: '/remnants/remnant_05.png',
        height: 4.5,
        rotationOffset: 0.6,
      },
      {
        kind: 'remnant',
        id: 'l3.remnant.06',
        position: REM(16, 4),
        texture: '/remnants/remnant_06.png',
        height: 6.5,
        rotationOffset: -0.5,
      },
      {
        kind: 'remnant',
        id: 'l3.remnant.07',
        position: REM(-18, -14),
        texture: '/remnants/remnant_07.png',
        height: 7,
        rotationOffset: 0.1,
      },
      {
        kind: 'remnant',
        id: 'l3.remnant.08',
        position: REM(4, -22),
        texture: '/remnants/remnant_08.png',
        height: 5,
        rotationOffset: -0.35,
      },
      { kind: 'rock_stack', id: 'l3.rock.east', position: REM(20, -2), scale: 1.3 },
      {
        kind: 'rock_stack',
        id: 'l3.rock.south-west',
        position: REM(-12, 18),
        scale: 0.9,
        rotation: 0.7,
      },
      // Cairns + roots fit the ash-and-bone palette of the Remnants.
      {
        kind: 'purple_stone_cairn',
        id: 'l3.cairn.a',
        position: REM(0, 0),
        scale: 1.6,
      },
      {
        kind: 'purple_stone_cairn',
        id: 'l3.cairn.b',
        position: REM(14, -18),
        scale: 1.2,
        rotation: 1.1,
      },
      {
        kind: 'tangled_root_sculpture',
        id: 'l3.roots.a',
        position: REM(-16, -8),
        scale: 1.5,
        rotation: 0.8,
      },
    ],
  },
};

export function findPlayerSpawn(level: LevelDefinition): { x: number; z: number } {
  return level.playerSpawn;
}
