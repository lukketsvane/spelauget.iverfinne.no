// One mega-map. Every NPC, prop, decorative GLB and portal lives in a
// single shared coordinate space inside a roughly-circular playable
// area (radius `WORLD_RADIUS`, see regions.ts). Region palettes
// (Lysningen warm magenta, Stjerneengen cool teal, Remnants ash gray)
// blend per-pixel based on world XZ.
//
// Layout: player spawns at world origin (= map centre). Lysningen
// surrounds the spawn (north-of-centre); Stjerneengen owns the east
// band where the locked gate + parked car live; Remnants is the
// south third where the big exit gate sits at the world's edge.
// Coordinates compressed so every spawn fits inside the 60 m
// boundary circle Character.tsx clamps the player to.
//
// Order in this file follows the natural north-to-south progression
// the player would take on foot.

import type { DialogueLine } from '@/store/dialogue';
import type { RegionId } from './regions';

// Single-level shim: useLevel still tracks `currentLevelId`, but it's
// always 'world' now.
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
  playerSpawn: { x: number; z: number };
  spawns: Spawn[];
};

// Trail-marker helper. Doubles as plant-exclusion bubbles so the
// path stays visibly clear even though we don't paint a real ground
// trail. Pseudo-random rotation per coord keeps the line of cairns
// from looking mechanically uniform.
function trailCairn(id: string, x: number, z: number, scale = 0.7): ScenerySpawn {
  return {
    kind: 'purple_stone_cairn',
    id,
    position: [x, z],
    scale,
    rotation: ((x * 7 + z * 13) % 6) - 3,
  };
}

// Perimeter ring: stones every 30° around radius BOUNDARY_RING_R
// (just inside the player clamp at WORLD_RADIUS=60). Mixes
// rock_stack and purple_stone_cairn so the ring reads as natural
// rather than a fence. Each tile rotates pseudo-randomly so the
// boundary doesn't feel symmetrical.
const BOUNDARY_RING_R = 56;
function perimeterRing(): Spawn[] {
  const out: Spawn[] = [];
  const count = 14;
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2;
    const x = Math.cos(a) * BOUNDARY_RING_R;
    const z = Math.sin(a) * BOUNDARY_RING_R;
    // Skip the southernmost stone — that's where the exit gate sits.
    // The angle ~π/2 (south) corresponds to i around count*0.25.
    const angDeg = (a * 180) / Math.PI;
    const isSouth = angDeg > 75 && angDeg < 105;
    if (isSouth) continue;
    // Alternate kinds so the ring has visual variety.
    const kind: SceneryKind | 'rock_stack' =
      i % 3 === 0
        ? 'rock_stack'
        : i % 3 === 1
          ? 'purple_stone_cairn'
          : 'tangled_root_sculpture';
    if (kind === 'rock_stack') {
      out.push({
        kind: 'rock_stack',
        id: `boundary.${i}`,
        position: [x, z],
        scale: 0.9 + ((i * 17) % 5) * 0.06,
        rotation: ((i * 0.7) % (Math.PI * 2)) - Math.PI,
      });
    } else {
      out.push({
        kind,
        id: `boundary.${i}`,
        position: [x, z],
        scale: 1.0 + ((i * 11) % 5) * 0.07,
        rotation: ((i * 1.3) % (Math.PI * 2)) - Math.PI,
      });
    }
  }
  return out;
}

export const LEVELS: Record<LevelId, LevelDefinition> = {
  world: {
    id: 'world',
    name: 'The Clearing',
    playerSpawn: { x: 0, z: 0 },
    spawns: [
      // ===================================================================
      // === LYSNINGEN — north-of-centre, around the player spawn ==========
      // ===================================================================

      // -- Player-start area (world origin = map centre). --
      { kind: 'purple_coral', id: 'lys.coral.start.a', position: [-8, -4], scale: 1.4 },
      { kind: 'glowing_purple_coral', id: 'lys.coral.start.b', position: [10, -2], scale: 1.2 },
      { kind: 'purple_stone_cairn', id: 'lys.cairn.start.a', position: [0, 6], scale: 0.9 },
      { kind: 'purple_stone_cairn', id: 'lys.cairn.start.b', position: [-5, -8], scale: 0.7 },

      // -- Digger NPC (north-west of spawn). --
      {
        kind: 'star_npc',
        id: 'lys.star.welcome',
        position: [-12, -18],
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
      { kind: 'tangled_root_sculpture', id: 'lys.roots.digger', position: [-18, -22], scale: 1.3, rotation: -0.4 },
      { kind: 'purple_coral_alt', id: 'lys.coral.digger', position: [-4, -22], scale: 1.0 },

      // -- Stone hut + Bobble (north-east). --
      { kind: 'stone_hut', id: 'lys.hut.upper-right', position: [18, -22], rotation: -0.3, scale: 0.9 },
      {
        kind: 'boble_npc',
        id: 'lys.boble.bobble',
        position: [28, -16],
        // Lead Bobble all the way south to the parked car. Once Bobble
        // + the player both stand within ~4.5 m of this point, Bobble
        // fades out and the car portal unlocks.
        leadTo: [32, 30],
        dialogue: [
          { text: 'Oh, a fresh face. The lights felt it before I did.' },
          { text: "I'm Bobble. I don't have legs. Just opinions, and wind." },
          { action: true, text: 'tilts, drifts a hand-width sideways, drifts back' },
          {
            text: 'So the digger gave you the key. They give it to most. I never asked why.',
          },
          {
            text: "There's a car at the south side. The digger told you to walk past. I think you should look.",
          },
          {
            text: "Take me to it. I'll keep close. When we're there, I won't be of any more use to you.",
          },
          { text: "Don't worry about me after. Just open the door." },
        ],
      },
      { kind: 'glowing_purple_coral', id: 'lys.coral.hut.a', position: [12, -10], scale: 1.0 },
      { kind: 'purple_coral', id: 'lys.coral.hut.b', position: [24, -10], scale: 1.1 },
      { kind: 'purple_stone_cairn', id: 'lys.cairn.hut', position: [10, -28], scale: 1.0 },

      // -- North-west cluster. --
      { kind: 'rock_stack', id: 'lys.rock.nw', position: [-26, -12], scale: 1.0 },
      { kind: 'purple_stone_cairn', id: 'lys.cairn.nw.a', position: [-32, -8], scale: 1.1 },
      { kind: 'tangled_root_sculpture', id: 'lys.roots.nw', position: [-22, -28], scale: 1.3, rotation: 0.6 },

      // -- Decorative natural props peppered around Lysningen. --
      { kind: 'neon_vascular_tree', id: 'lys.tree.a', position: [-18, 4], scale: 1.2, rotation: 0.4 },
      { kind: 'neon_vascular_tree', id: 'lys.tree.b', position: [32, -8], scale: 1.0, rotation: -0.2 },
      { kind: 'trilo', id: 'lys.trilo.a', position: [-15, 8], scale: 1.3, rotation: 0.8, color: '#a456c8', emissive: '#2a1140' },
      { kind: 'trilo', id: 'lys.trilo.b', position: [10, 12], scale: 1.1, rotation: -1.1, color: '#bf5fd8', emissive: '#321252' },

      // -- Trail markers continuing south from spawn. --
      trailCairn('trail.a', 2, 14),
      trailCairn('trail.b', -2, 24),

      // ===================================================================
      // === STJERNEENGEN — east + middle band =============================
      // ===================================================================

      // -- Locked stone gate on the east side. Optional fast-travel
      //    to the Stjerneengen waypoint; player can also walk over. --
      {
        kind: 'portal',
        id: 'stj.portal.lock',
        position: [38, 0],
        targetRegion: 'stjerneengen',
        colorA: '#a4d8ff',
        colorB: '#3a4cff',
      },
      { kind: 'stone_hut', id: 'stj.hut.east', position: [44, -2], rotation: 0.5, scale: 0.85 },
      { kind: 'rock_stack', id: 'stj.rock.gate', position: [32, 4], scale: 0.95, rotation: 0.4 },
      { kind: 'purple_stone_cairn', id: 'stj.cairn.gate.a', position: [42, 8], scale: 1.0 },
      { kind: 'purple_stone_cairn', id: 'stj.cairn.gate.b', position: [30, -6], scale: 0.8 },

      // -- Mid-region scenery. Stjerneengen palette dominates here so
      //    trilos read with cool teal tints. --
      {
        kind: 'trilo',
        id: 'stj.trilo.center',
        position: [25, 18],
        scale: 1.4,
        rotation: 0.8,
        color: '#3d99a8',
        emissive: '#0a2a3a',
      },
      {
        kind: 'trilo',
        id: 'stj.trilo.east',
        position: [42, 22],
        scale: 1.6,
        rotation: -1.2,
        color: '#4ec0c5',
        emissive: '#0c3340',
      },
      { kind: 'rock_stack', id: 'stj.rock.center', position: [12, 22], scale: 1.2 },
      { kind: 'rock_stack', id: 'stj.rock.east', position: [44, 28], scale: 0.9, rotation: 1.1 },

      // -- West side scattering. --
      { kind: 'rock_stack', id: 'stj.rock.west', position: [-32, 14], scale: 1.0, rotation: -0.3 },
      { kind: 'tangled_root_sculpture', id: 'stj.roots.west', position: [-28, 24], scale: 1.4, rotation: 1.0 },
      { kind: 'glowing_purple_coral', id: 'stj.coral.west', position: [-22, 16], scale: 1.0 },

      // -- Relic-dominated zone. The Star Meadow is the artefact
      //    field of this world: six painted-card relics scattered
      //    across the middle band so wherever the player stops
      //    inside Stjerneengen, at least one is nearby. Heights
      //    vary so the silhouettes don't read as a uniform fence. --
      {
        kind: 'relic',
        id: 'stj.relic.north',
        position: [-4, 8],
        texture: '/relic1%201.png',
        height: 5.0,
      },
      {
        kind: 'relic',
        id: 'stj.relic.east',
        position: [48, 18],
        texture: '/relic3%201.png',
        height: 5.5,
      },
      {
        kind: 'relic',
        id: 'stj.relic.west',
        position: [-18, 26],
        texture: '/relic2%201.png',
        height: 4.5,
      },
      {
        kind: 'relic',
        id: 'stj.relic.center',
        position: [16, 14],
        texture: '/relic4%201.png',
        height: 4.2,
      },
      {
        kind: 'relic',
        id: 'stj.relic.south',
        position: [4, 36],
        texture: '/relic2%201.png',
        height: 4.8,
      },
      {
        kind: 'relic',
        id: 'stj.relic.far-east',
        position: [38, 8],
        texture: '/relic1%201.png',
        height: 5.2,
      },

      // -- Trail markers continuing south. --
      trailCairn('trail.c', 3, 32),
      trailCairn('trail.d', -2, 40),

      // -- The car the digger warned about. Becomes interactable
      //    once the player has led Bobble to it. --
      {
        kind: 'car_portal',
        id: 'stj.car.parked',
        position: [32, 30],
        rotation: 0.6,
        targetRegion: 'remnants',
        gate: 'bobbleVanished',
      },
      { kind: 'tangled_root_sculpture', id: 'stj.roots.car', position: [38, 26], scale: 1.1, rotation: -0.6 },
      { kind: 'purple_coral_alt', id: 'stj.coral.car', position: [26, 36], scale: 1.0 },

      // ===================================================================
      // === REMNANTS — south third, ending at the world boundary =========
      // ===================================================================

      // -- The big exit gate at the southern edge of the playable
      //    circle. Bowing here loops the player back to Lysningen so
      //    the world feels like a circuit rather than a dead end. --
      {
        kind: 'portal',
        id: 'rem.portal.exit',
        position: [0, 52],
        targetRegion: 'lysningen',
        colorA: '#cdd2dc',
        colorB: '#3b414e',
      },

      // -- Remnant silhouettes flanking the path to the exit. Tighter
      //    cluster than before so they all sit comfortably inside the
      //    boundary. --
      {
        kind: 'remnant',
        id: 'rem.silhouette.01',
        position: [-22, 42],
        texture: '/remnants/remnant_01.png',
        height: 5.5,
        rotationOffset: -0.3,
      },
      {
        kind: 'remnant',
        id: 'rem.silhouette.02',
        position: [-12, 46],
        texture: '/remnants/remnant_02.png',
        height: 4.8,
        rotationOffset: 0.2,
      },
      {
        kind: 'remnant',
        id: 'rem.silhouette.03',
        position: [12, 46],
        texture: '/remnants/remnant_03.png',
        height: 6,
        rotationOffset: -0.15,
      },
      {
        kind: 'remnant',
        id: 'rem.silhouette.04',
        position: [22, 42],
        texture: '/remnants/remnant_04.png',
        height: 5,
        rotationOffset: 0.25,
      },
      {
        kind: 'remnant',
        id: 'rem.silhouette.05',
        position: [-30, 36],
        texture: '/remnants/remnant_05.png',
        height: 4.5,
        rotationOffset: 0.5,
      },
      {
        kind: 'remnant',
        id: 'rem.silhouette.06',
        position: [-18, 50],
        texture: '/remnants/remnant_06.png',
        height: 6.5,
        rotationOffset: -0.5,
      },
      {
        kind: 'remnant',
        id: 'rem.silhouette.07',
        position: [16, 50],
        texture: '/remnants/remnant_07.png',
        height: 5,
        rotationOffset: 0.1,
      },
      {
        kind: 'remnant',
        id: 'rem.silhouette.08',
        position: [28, 38],
        texture: '/remnants/remnant_08.png',
        height: 5,
        rotationOffset: -0.35,
      },

      // -- Cairns flanking the exit gate. --
      { kind: 'purple_stone_cairn', id: 'rem.cairn.gate.a', position: [-7, 50], scale: 1.3, rotation: 0.3 },
      { kind: 'purple_stone_cairn', id: 'rem.cairn.gate.b', position: [8, 50], scale: 1.2, rotation: -0.4 },

      // -- Perimeter ring of stones around the boundary circle. --
      ...perimeterRing(),
    ],
  },
};

export function findPlayerSpawn(level: LevelDefinition): { x: number; z: number } {
  return level.playerSpawn;
}
