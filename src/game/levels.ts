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
import { WORLD_RADIUS } from './regions';

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
  model?: 'car_01' | 'car_02';
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

// World-scale multiplier for the BASE_SPAWNS array below. Bumping
// this stretches the whole map proportionally — every spawn position
// (and every Bobble leadTo) gets multiplied at LEVELS-time. Pair
// this with WORLD_RADIUS / MAP_BOUNDS / REGION centres in regions.ts
// so the layout stays self-consistent.
const WORLD_SCALE = 2;

// Trail-marker helper. Doubles as plant-exclusion bubbles so the
// path stays visibly clear even though we don't paint a real ground
// trail. Pseudo-random rotation per coord keeps the line of cairns
// from looking mechanically uniform. Coordinates are in BASE units;
// the WORLD_SCALE multiplier is applied at array assembly.
function trailCairn(id: string, x: number, z: number, scale = 0.7): ScenerySpawn {
  return {
    kind: 'purple_stone_cairn',
    id,
    position: [x, z],
    scale,
    rotation: ((x * 7 + z * 13) % 6) - 3,
  };
}

// Multiplies every spawn position (and Bobble leadTo) by WORLD_SCALE
// at array-assembly time. Lets BASE_SPAWNS keep its readable
// "logical" coordinates while the actual game world stretches.
function applyWorldScale(spawns: Spawn[]): Spawn[] {
  return spawns.map((s) => {
    const scaled: Spawn = {
      ...s,
      position: [s.position[0] * WORLD_SCALE, s.position[1] * WORLD_SCALE],
    };
    if (s.kind === 'boble_npc' && s.leadTo) {
      (scaled as BobleNpcSpawn).leadTo = [
        s.leadTo[0] * WORLD_SCALE,
        s.leadTo[1] * WORLD_SCALE,
      ];
    }
    return scaled;
  });
}

// Perimeter ring: stones around radius BOUNDARY_RING_R (just inside
// the player clamp at WORLD_RADIUS). Denser than before — 28 stones
// around the full circumference, with a southern gap for the exit
// gate. Mixes rock_stack, purple_stone_cairn, and tangled_root
// sculpture so the ring reads as a natural cluster rather than a
// fence. Already in WORLD coordinates (uses the bumped WORLD_RADIUS
// directly); not run through applyWorldScale.
const BOUNDARY_RING_R = WORLD_RADIUS - 4;
function perimeterRing(): Spawn[] {
  const out: Spawn[] = [];
  const count = 28;
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2;
    // Slight radial jitter (±2 m) so the ring doesn't read as a
    // perfect circle from the air.
    const r = BOUNDARY_RING_R + (((i * 31) % 7) - 3) * 0.6;
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    // Skip the southernmost stones — that's where the exit gate sits.
    const angDeg = (a * 180) / Math.PI;
    const isSouthGate = angDeg > 82 && angDeg < 98;
    if (isSouthGate) continue;
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
        scale: 1.1 + ((i * 17) % 5) * 0.08,
        rotation: ((i * 0.7) % (Math.PI * 2)) - Math.PI,
      });
    } else {
      out.push({
        kind,
        id: `boundary.${i}`,
        position: [x, z],
        scale: 1.2 + ((i * 11) % 5) * 0.09,
        rotation: ((i * 1.3) % (Math.PI * 2)) - Math.PI,
      });
    }
  }
  return out;
}

// "Logical" spawn coordinates — each (x, z) is in a 60-radius design
// frame. applyWorldScale multiplies them by WORLD_SCALE before they
// hit the runtime, so bumping WORLD_SCALE expands the whole map
// proportionally without touching individual entries.
const BASE_SPAWNS: Spawn[] = [
      // ===================================================================
      // === LYSNINGEN — north-of-centre, around the player spawn ==========
      // ===================================================================

      // -- Player-start area (world origin = map centre).
      // Sparse alcove so the digger NPC is unmissable right north
      // of the spawn. Kept the corals as side decoration but pulled
      // them OFF the north axis the player will look down first. --
      { kind: 'purple_coral', id: 'lys.coral.start.a', position: [-9, 4], scale: 1.3 },
      { kind: 'glowing_purple_coral', id: 'lys.coral.start.b', position: [10, 2], scale: 1.2 },
      { kind: 'purple_coral_alt', id: 'lys.coral.start.c', position: [8, -6], scale: 1.1 },
      { kind: 'purple_stone_cairn', id: 'lys.cairn.start.a', position: [3, 6], scale: 0.8 },
      { kind: 'purple_stone_cairn', id: 'lys.cairn.start.b', position: [-7, 2], scale: 0.65 },
      { kind: 'tangled_root_sculpture', id: 'lys.roots.start', position: [6, 6], scale: 0.95, rotation: 0.9 },

      // -- Digger NPC: directly north of the spawn, ~9 m away. The
      //    player's iso camera frames straight south-west, so a prop
      //    placed at world (0, -9) sits at the visible top-edge of
      //    the spawn frame — completely unmissable. A single bright
      //    glowing coral right beside the digger acts as a beacon
      //    so the lying-flat dig animation reads as "here is
      //    something, walk over". --
      {
        kind: 'star_npc',
        id: 'lys.star.welcome',
        position: [0, -9],
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
      // -- Dig site, kept deliberately sparse so the digger silhouette
      //    is the visual focus. One bright glowing coral RIGHT next
      //    to them acts as a "look here" beacon; the rest of the
      //    cluster sits a few metres away so it frames rather than
      //    crowds. --
      { kind: 'glowing_purple_coral', id: 'lys.coral.digger.beacon', position: [3, -8], scale: 1.2 },
      { kind: 'tangled_root_sculpture', id: 'lys.roots.digger.a', position: [-8, -16], scale: 1.2, rotation: -0.4 },
      { kind: 'tangled_root_sculpture', id: 'lys.roots.digger.b', position: [8, -16], scale: 0.9, rotation: 1.1 },
      { kind: 'purple_coral_alt', id: 'lys.coral.digger.a', position: [-10, -6], scale: 0.9 },
      { kind: 'purple_stone_cairn', id: 'lys.cairn.digger.a', position: [-4, -16], scale: 0.7 },
      { kind: 'purple_stone_cairn', id: 'lys.cairn.digger.b', position: [6, -14], scale: 0.6 },

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
      // -- Hut surroundings — the homestead reads as inhabited
      //    rather than abandoned. --
      { kind: 'glowing_purple_coral', id: 'lys.coral.hut.a', position: [12, -10], scale: 1.0 },
      { kind: 'purple_coral', id: 'lys.coral.hut.b', position: [24, -10], scale: 1.1 },
      { kind: 'purple_coral_alt', id: 'lys.coral.hut.c', position: [22, -28], scale: 0.95 },
      { kind: 'purple_stone_cairn', id: 'lys.cairn.hut.a', position: [10, -28], scale: 1.0 },
      { kind: 'purple_stone_cairn', id: 'lys.cairn.hut.b', position: [25, -18], scale: 0.7 },
      { kind: 'tangled_root_sculpture', id: 'lys.roots.hut', position: [32, -22], scale: 1.0, rotation: -0.7 },

      // -- North-west cluster: a denser thicket of stones + roots
      //    framing the boundary on that side. --
      { kind: 'rock_stack', id: 'lys.rock.nw.a', position: [-26, -12], scale: 1.0 },
      { kind: 'rock_stack', id: 'lys.rock.nw.b', position: [-36, -22], scale: 0.85, rotation: 0.5 },
      { kind: 'purple_stone_cairn', id: 'lys.cairn.nw.a', position: [-32, -8], scale: 1.1 },
      { kind: 'purple_stone_cairn', id: 'lys.cairn.nw.b', position: [-40, -2], scale: 0.85 },
      { kind: 'tangled_root_sculpture', id: 'lys.roots.nw', position: [-22, -28], scale: 1.3, rotation: 0.6 },
      { kind: 'glowing_purple_coral', id: 'lys.coral.nw', position: [-30, -18], scale: 1.1 },
      { kind: 'purple_coral', id: 'lys.coral.nw.b', position: [-38, -12], scale: 0.95 },

      // -- North arc (above the spawn) — fills the gap between
      //    spawn and the boundary so the player isn't staring at
      //    bare ground when they look due north. --
      { kind: 'neon_vascular_tree', id: 'lys.tree.north', position: [4, -32], scale: 1.3, rotation: 0.2 },
      { kind: 'tangled_root_sculpture', id: 'lys.roots.north', position: [-6, -28], scale: 1.1, rotation: 0.4 },
      { kind: 'glowing_purple_coral', id: 'lys.coral.north', position: [-16, -32], scale: 1.0 },
      { kind: 'purple_stone_cairn', id: 'lys.cairn.north', position: [10, -36], scale: 0.9 },

      // -- Decorative natural props peppered around Lysningen. --
      { kind: 'neon_vascular_tree', id: 'lys.tree.a', position: [-18, 4], scale: 1.2, rotation: 0.4 },
      { kind: 'neon_vascular_tree', id: 'lys.tree.b', position: [32, -8], scale: 1.0, rotation: -0.2 },
      { kind: 'trilo', id: 'lys.trilo.a', position: [-15, 8], scale: 1.3, rotation: 0.8, color: '#a456c8', emissive: '#2a1140' },
      { kind: 'trilo', id: 'lys.trilo.b', position: [10, 12], scale: 1.1, rotation: -1.1, color: '#bf5fd8', emissive: '#321252' },
      { kind: 'trilo', id: 'lys.trilo.c', position: [22, 4], scale: 1.0, rotation: 0.3, color: '#9c4fb8', emissive: '#220a35' },

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

      // -- West side scattering — denser cluster framing the meadow
      //    so players walking west don't fall off into bare ground. --
      { kind: 'rock_stack', id: 'stj.rock.west.a', position: [-32, 14], scale: 1.0, rotation: -0.3 },
      { kind: 'rock_stack', id: 'stj.rock.west.b', position: [-40, 22], scale: 0.85, rotation: 0.6 },
      { kind: 'tangled_root_sculpture', id: 'stj.roots.west', position: [-28, 24], scale: 1.4, rotation: 1.0 },
      { kind: 'glowing_purple_coral', id: 'stj.coral.west.a', position: [-22, 16], scale: 1.0 },
      { kind: 'glowing_purple_coral', id: 'stj.coral.west.b', position: [-34, 8], scale: 0.95 },
      { kind: 'purple_coral_alt', id: 'stj.coral.west.c', position: [-38, 32], scale: 1.0 },
      { kind: 'purple_stone_cairn', id: 'stj.cairn.west', position: [-26, 32], scale: 0.85 },

      // -- Second car: an abandoned wreck (car_02) on the west side
      //    of the meadow, opposite the parked-and-warned-about car.
      //    Adds the "graveyard of cars" feel the digger's warning
      //    suggests — multiple wrecks in this clearing, not just one.
      //    Static (non-portal); just a collidable prop. --
      {
        kind: 'car',
        id: 'stj.car.wreck',
        position: [-12, 18],
        rotation: -1.4,
        scale: 6,
        model: 'car_02',
      },
      { kind: 'tangled_root_sculpture', id: 'stj.roots.wreck', position: [-16, 22], scale: 1.1, rotation: 0.8 },
      { kind: 'purple_stone_cairn', id: 'stj.cairn.wreck.a', position: [-8, 22], scale: 0.7 },
      { kind: 'purple_stone_cairn', id: 'stj.cairn.wreck.b', position: [-16, 14], scale: 0.65 },

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
        scale: 6,
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
      { kind: 'purple_stone_cairn', id: 'rem.cairn.gate.c', position: [-12, 54], scale: 0.9, rotation: 1.1 },
      { kind: 'purple_stone_cairn', id: 'rem.cairn.gate.d', position: [12, 54], scale: 0.95, rotation: -1.0 },

      // -- Tangled roots between the remnants — the silhouettes
      //    don't read as "monuments in a field" without something
      //    growing between them. --
      { kind: 'tangled_root_sculpture', id: 'rem.roots.a', position: [-22, 46], scale: 1.2, rotation: 0.4 },
      { kind: 'tangled_root_sculpture', id: 'rem.roots.b', position: [20, 38], scale: 1.0, rotation: -0.6 },
      { kind: 'tangled_root_sculpture', id: 'rem.roots.c', position: [0, 40], scale: 1.4, rotation: 1.1 },

      // -- A neon vascular tree as a tall silhouette near the exit
      //    (extra vertical interest in an otherwise low-profile
      //    region full of squat ruins). --
      { kind: 'neon_vascular_tree', id: 'rem.tree.exit', position: [4, 44], scale: 1.5, rotation: 0.6 },

      // -- Extra rock_stacks scattered for ground texture. --
      { kind: 'rock_stack', id: 'rem.rock.east', position: [32, 46], scale: 0.95, rotation: 0.7 },
      { kind: 'rock_stack', id: 'rem.rock.west', position: [-32, 46], scale: 0.85, rotation: -0.5 },
      { kind: 'rock_stack', id: 'rem.rock.north', position: [4, 32], scale: 0.8, rotation: 0.3 },
];

export const LEVELS: Record<LevelId, LevelDefinition> = {
  world: {
    id: 'world',
    name: 'The Clearing',
    playerSpawn: { x: 0, z: 0 },
    spawns: [
      // BASE_SPAWNS get their positions x WORLD_SCALE so the whole
      // layout stretches with one knob; perimeterRing already lives
      // in WORLD_RADIUS coordinates and goes through unchanged.
      ...applyWorldScale(BASE_SPAWNS),
      ...perimeterRing(),
    ],
  },
};

export function findPlayerSpawn(level: LevelDefinition): { x: number; z: number } {
  return level.playerSpawn;
}
