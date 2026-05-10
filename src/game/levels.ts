// One mega-map. Every NPC, prop, decorative GLB and portal lives in a
// single shared coordinate space. Region palettes (Lysningen warm
// magenta, Stjerneengen cool teal, Remnants ash gray) come from
// regions.ts and blend per-pixel based on world XZ.
//
// Spawn coordinates are anchored to the map.png reference: each
// landmark's pixel UV in that image is converted via MAP_BOUNDS (see
// regions.ts) to world (x, z). Player-start at the top of the map
// lands on world origin; the big exit gate at the bottom lands ~110 m
// south. The order in this file follows the natural north-to-south
// progression visible on the map.
//
// Adding a new spawn kind:
//   1. Add the variant to the Spawn union below.
//   2. Add a case in Spawns.tsx that mounts the matching component.

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
  // Optional [x, z] in world space. After dialogue, Bobble follows
  // the player. Once Bobble + the player both reach this point,
  // Bobble fades out and `useGame.bobbleVanished` flips, unlocking
  // whatever is gated on that flag (the parked car, in our case).
  leadTo?: [number, number];
};

// Inter-region fast-travel portal. Bowing within range fades to black,
// translates the player to the target region's waypoint centre, then
// fades back in.
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

// Trail-marker helper: small `purple_stone_cairn` along the main
// north-to-south path so the route reads as a worn track on the
// ground even though we don't paint a real path texture. Cairns
// double as plant-exclusion bubbles, so plants stay off the trail.
function trailCairn(id: string, x: number, z: number, scale = 0.7): ScenerySpawn {
  return {
    kind: 'purple_stone_cairn',
    id,
    position: [x, z],
    scale,
    rotation: ((x * 7 + z * 13) % 6) - 3, // pseudo-random rotation per position
  };
}

export const LEVELS: Record<LevelId, LevelDefinition> = {
  world: {
    id: 'world',
    name: 'The Clearing',
    playerSpawn: { x: 0, z: 0 },
    spawns: [
      // ===================================================================
      // === LYSNINGEN — top of the map ===================================
      // ===================================================================

      // -- Player-start area (around world origin, UV ~0.5, 0.07) --
      // A small cluster of corals + a cairn frames the spawn so the
      // player's first frame already shows depth around them.
      { kind: 'purple_coral', id: 'lys.coral.start.a', position: [-8, -4], scale: 1.4 },
      { kind: 'glowing_purple_coral', id: 'lys.coral.start.b', position: [10, -2], scale: 1.2 },
      trailCairn('lys.cairn.start', 0, 6, 0.9),

      // -- Digger NPC (the figure shown digging mid-frame on the map,
      //    UV ~0.43, 0.22). Hands the player the key. --
      {
        kind: 'star_npc',
        id: 'lys.star.welcome',
        position: [-10, 21],
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
      // Ring of decoration around the digger so they read as a focal
      // point rather than a lone figure on bare ground.
      { kind: 'tangled_root_sculpture', id: 'lys.roots.digger', position: [-15, 25], scale: 1.3, rotation: -0.4 },
      { kind: 'purple_coral_alt', id: 'lys.coral.digger', position: [-2, 24], scale: 1.1 },

      // -- Top-right hut + Bobble (UV ~0.65, 0.12 / 0.75, 0.10). The
      //    map shows the hut paired with a chat-bubble NPC right
      //    beside it; that's where Bobble lives. --
      { kind: 'stone_hut', id: 'lys.hut.upper-right', position: [21, 8], rotation: -0.3 },
      {
        kind: 'boble_npc',
        id: 'lys.boble.bobble',
        position: [35, 4],
        // Lead Bobble all the way south to the parked car — the long
        // walk is the point. Once Bobble + player both stand within
        // ~4.5 m of this point, Bobble fades out and the car portal
        // unlocks.
        leadTo: [39, 77],
        dialogue: [
          { text: 'Oh, a fresh face. The lights felt it before I did.' },
          { text: "I'm Bobble. I don't have legs. Just opinions, and wind." },
          { action: true, text: 'tilts, drifts a hand-width sideways, drifts back' },
          {
            text: 'So the digger gave you the key. They give it to most. I never asked why.',
          },
          {
            text: "There's a car at the south edge of the world. The digger told you to walk past. I think you should look.",
          },
          {
            text: "Take me to it. I'll keep close. The way is long. When we're there, I won't be of any more use to you.",
          },
          { text: "Don't worry about me after. Just open the door." },
        ],
      },
      // Scenery near the hut.
      { kind: 'glowing_purple_coral', id: 'lys.coral.hut.a', position: [16, 14], scale: 1.0 },
      { kind: 'purple_coral', id: 'lys.coral.hut.b', position: [28, 14], scale: 1.2 },
      trailCairn('lys.cairn.hut.a', 14, 4),

      // -- North-west cluster (rock_stack near upper-left, UV ~0.30,
      //    0.18, plus scattered cairns) --
      { kind: 'rock_stack', id: 'lys.rock.nw', position: [-30, 14], scale: 1.1 },
      { kind: 'purple_stone_cairn', id: 'lys.cairn.nw.a', position: [-42, 18], scale: 1.2 },
      { kind: 'purple_stone_cairn', id: 'lys.cairn.nw.b', position: [-52, 8], scale: 0.9 },
      { kind: 'tangled_root_sculpture', id: 'lys.roots.nw', position: [-38, 28], scale: 1.4, rotation: 0.6 },

      // -- North-to-south trail markers (player-start → south). --
      trailCairn('trail.a', 2, 14),
      trailCairn('trail.b', 0, 30),
      trailCairn('trail.c', -3, 42),

      // -- Decorative natural props peppered around Lysningen --
      { kind: 'neon_vascular_tree', id: 'lys.tree.a', position: [-22, 0], scale: 1.3, rotation: 0.4 },
      { kind: 'neon_vascular_tree', id: 'lys.tree.b', position: [40, -4], scale: 1.1, rotation: -0.2 },
      { kind: 'trilo', id: 'lys.trilo.a', position: [-18, 38], scale: 1.4, rotation: 0.8, color: '#a456c8', emissive: '#2a1140' },
      { kind: 'trilo', id: 'lys.trilo.b', position: [10, 42], scale: 1.2, rotation: -1.1, color: '#bf5fd8', emissive: '#321252' },

      // ===================================================================
      // === STJERNEENGEN — east + middle band ============================
      // ===================================================================

      // -- Locked stone gate on the east side (UV ~0.78, 0.30). On the
      //    map it's drawn with a padlock; in code it's the existing
      //    key-gated portal that fast-travels to the Stjerneengen
      //    waypoint (i.e. the centre of this region). Optional — the
      //    player can also just walk over there. --
      {
        kind: 'portal',
        id: 'stj.portal.lock',
        position: [39, 32],
        targetRegion: 'stjerneengen',
        colorA: '#a4d8ff',
        colorB: '#3a4cff',
      },
      // The little stone arch that frames the locked-gate icon on the
      // map. Made of cairns + a hut so the area feels built rather
      // than just a portal floating in grass.
      { kind: 'stone_hut', id: 'stj.hut.east', position: [50, 30], rotation: 0.5, scale: 0.85 },
      { kind: 'rock_stack', id: 'stj.rock.gate', position: [33, 36], scale: 1.0, rotation: 0.4 },
      { kind: 'purple_stone_cairn', id: 'stj.cairn.gate.a', position: [44, 38], scale: 1.0 },
      { kind: 'purple_stone_cairn', id: 'stj.cairn.gate.b', position: [30, 24], scale: 0.8 },

      // -- Mid-region scenery (Stjerneengen blends in around z = 50,
      //    so trilos here read with cool teal tints). --
      {
        kind: 'trilo',
        id: 'stj.trilo.center',
        position: [33, 50],
        scale: 1.6,
        rotation: 0.8,
        color: '#3d99a8',
        emissive: '#0a2a3a',
      },
      {
        kind: 'trilo',
        id: 'stj.trilo.east',
        position: [48, 58],
        scale: 1.8,
        rotation: -1.2,
        color: '#4ec0c5',
        emissive: '#0c3340',
      },
      { kind: 'rock_stack', id: 'stj.rock.center', position: [15, 60], scale: 1.3 },
      { kind: 'rock_stack', id: 'stj.rock.east', position: [50, 64], scale: 0.9, rotation: 1.1 },

      // -- Lower-mid west scattering (chat-bubble NPC area on the
      //    map at UV ~0.18, 0.40 — no NPC mounted there, but the
      //    cairn cluster keeps the silhouette visible). --
      { kind: 'rock_stack', id: 'stj.rock.west', position: [-44, 50], scale: 1.1, rotation: -0.3 },
      { kind: 'purple_stone_cairn', id: 'stj.cairn.west.a', position: [-50, 60], scale: 1.0 },
      { kind: 'tangled_root_sculpture', id: 'stj.roots.west', position: [-38, 62], scale: 1.5, rotation: 1.0 },
      { kind: 'glowing_purple_coral', id: 'stj.coral.west', position: [-30, 56], scale: 1.0 },

      // -- A relic-card scattered along the way as a curiosity. --
      {
        kind: 'relic',
        id: 'stj.relic.east',
        position: [55, 50],
        texture: '/relic3%201.png',
        height: 5.5,
      },
      {
        kind: 'relic',
        id: 'stj.relic.west',
        position: [-22, 70],
        texture: '/relic2%201.png',
        height: 4.5,
      },

      // -- Trail markers continuing south. --
      trailCairn('trail.d', 3, 56),
      trailCairn('trail.e', -2, 72),
      trailCairn('trail.f', 0, 86),

      // -- The car the digger warned about (UV ~0.78, 0.62). Becomes
      //    interactable once the player has led Bobble to it. --
      {
        kind: 'car_portal',
        id: 'stj.car.parked',
        position: [39, 77],
        rotation: 0.6,
        targetRegion: 'remnants',
        gate: 'bobbleVanished',
      },
      { kind: 'tangled_root_sculpture', id: 'stj.roots.car', position: [44, 70], scale: 1.2, rotation: -0.6 },
      { kind: 'purple_coral_alt', id: 'stj.coral.car', position: [33, 84], scale: 1.1 },
      { kind: 'rock_stack', id: 'stj.rock.car', position: [48, 86], scale: 0.9, rotation: 0.2 },

      // ===================================================================
      // === REMNANTS — south end ==========================================
      // ===================================================================

      // -- The big exit gate at the bottom of the map (UV ~0.49,
      //    0.86). This is the deepest point; bowing here loops the
      //    player back to Lysningen so the world feels like a
      //    circuit rather than a dead end. --
      {
        kind: 'portal',
        id: 'rem.portal.exit',
        position: [-1, 110],
        targetRegion: 'lysningen',
        colorA: '#cdd2dc',
        colorB: '#3b414e',
      },

      // -- Remnant silhouettes scattered around the south. The 8
      //    chunky alpha-cut PNGs the user authored work best as a
      //    semi-circle of monuments south of the player's current
      //    path. --
      {
        kind: 'remnant',
        id: 'rem.silhouette.01',
        position: [-22, 100],
        texture: '/remnants/remnant_01.png',
        height: 5.5,
        rotationOffset: -0.3,
      },
      {
        kind: 'remnant',
        id: 'rem.silhouette.02',
        position: [-12, 96],
        texture: '/remnants/remnant_02.png',
        height: 4.8,
        rotationOffset: 0.2,
      },
      {
        kind: 'remnant',
        id: 'rem.silhouette.03',
        position: [12, 96],
        texture: '/remnants/remnant_03.png',
        height: 6,
        rotationOffset: -0.15,
      },
      {
        kind: 'remnant',
        id: 'rem.silhouette.04',
        position: [22, 100],
        texture: '/remnants/remnant_04.png',
        height: 5,
        rotationOffset: 0.25,
      },
      {
        kind: 'remnant',
        id: 'rem.silhouette.05',
        position: [-30, 116],
        texture: '/remnants/remnant_05.png',
        height: 4.5,
        rotationOffset: 0.5,
      },
      {
        kind: 'remnant',
        id: 'rem.silhouette.06',
        position: [-15, 122],
        texture: '/remnants/remnant_06.png',
        height: 6.5,
        rotationOffset: -0.5,
      },
      {
        kind: 'remnant',
        id: 'rem.silhouette.07',
        position: [16, 122],
        texture: '/remnants/remnant_07.png',
        height: 7,
        rotationOffset: 0.1,
      },
      {
        kind: 'remnant',
        id: 'rem.silhouette.08',
        position: [30, 118],
        texture: '/remnants/remnant_08.png',
        height: 5,
        rotationOffset: -0.35,
      },

      // -- Cairns flanking the exit gate to frame it. --
      { kind: 'purple_stone_cairn', id: 'rem.cairn.gate.a', position: [-8, 106], scale: 1.4, rotation: 0.3 },
      { kind: 'purple_stone_cairn', id: 'rem.cairn.gate.b', position: [8, 106], scale: 1.3, rotation: -0.4 },
      { kind: 'rock_stack', id: 'rem.rock.gate', position: [0, 116], scale: 1.0 },

      // -- A few extra deep-south rocks for silhouette interest. --
      { kind: 'rock_stack', id: 'rem.rock.east', position: [38, 105], scale: 0.9 },
      { kind: 'rock_stack', id: 'rem.rock.west', position: [-38, 100], scale: 0.8, rotation: 0.6 },
    ],
  },
};

export function findPlayerSpawn(level: LevelDefinition): { x: number; z: number } {
  return level.playerSpawn;
}
