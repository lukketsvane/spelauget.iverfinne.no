// Hagen — first world, the garden / clearing the player wakes up in.
// All NPC dialogue, the digger key handoff, and the breadcrumb cairn
// trail north to the portal that leads OUT of Hagen live here. This
// is the only world that ships with content for now; the other four
// (blodverden, flisverden, saltverden, speilverden) are intentionally
// blank slates.
//
// Two coordinate frames are used:
//   - BASE_SPAWNS: authored in a 60-radius design frame, multiplied
//     through applyWorldScale (×2) at export time so individual
//     positions stay readable.
//   - CHAIN + perimeter + skate: authored directly in world coords
//     (the runtime 120-radius frame). They skip applyWorldScale.

import { applyWorldScale, perimeterRing, trailCairn } from '../helpers';
import type { Spawn } from '../types';

// Logical (60-radius design frame) spawn list — Hagen's NPCs, plants,
// homestead. applyWorldScale(×2) below stretches it to runtime coords.
const BASE_SPAWNS: Spawn[] = [
  // -- Player-start area (world origin = map centre).
  // Sparse alcove so the digger NPC is unmissable right north of
  // spawn. Corals act as side decoration but stay OFF the north
  // axis the player will look down first. --
  { kind: 'purple_coral', id: 'lys.coral.start.a', position: [-9, 4], scale: 1.3 },
  { kind: 'glowing_purple_coral', id: 'lys.coral.start.b', position: [10, 2], scale: 1.2 },
  { kind: 'purple_coral_alt', id: 'lys.coral.start.c', position: [8, -6], scale: 1.1 },
  { kind: 'purple_stone_cairn', id: 'lys.cairn.start.a', position: [3, 6], scale: 0.8 },
  { kind: 'purple_stone_cairn', id: 'lys.cairn.start.b', position: [-7, 2], scale: 0.65 },
  { kind: 'tangled_root_sculpture', id: 'lys.roots.start', position: [6, 6], scale: 0.95, rotation: 0.9 },

  // -- Digger NPC: directly north of the spawn, ~9 m away. The
  //    iso camera frames straight south-west, so a prop placed at
  //    world (0, -9) sits at the visible top-edge of the spawn
  //    frame — completely unmissable. A single bright glowing
  //    coral right beside the digger acts as a beacon so the
  //    lying-flat dig animation reads as "here is something". --
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
    ],
  },
  // -- Dig site, kept deliberately sparse so the digger silhouette
  //    is the visual focus. --
  { kind: 'glowing_purple_coral', id: 'lys.coral.digger.beacon', position: [3, -8], scale: 1.2 },
  { kind: 'tangled_root_sculpture', id: 'lys.roots.digger.a', position: [-8, -16], scale: 1.2, rotation: -0.4 },
  { kind: 'tangled_root_sculpture', id: 'lys.roots.digger.b', position: [8, -16], scale: 0.9, rotation: 1.1 },
  { kind: 'purple_coral_alt', id: 'lys.coral.digger.a', position: [-10, -6], scale: 0.9 },
  { kind: 'purple_stone_cairn', id: 'lys.cairn.digger.a', position: [-4, -16], scale: 0.7 },
  { kind: 'purple_stone_cairn', id: 'lys.cairn.digger.b', position: [6, -14], scale: 0.6 },

  // -- Stone hut + Bobble (north-east). Bobble's leadTo originally
  //    pointed at a parked-car portal in stjerneengen; with that zone
  //    gone she's a chatty NPC without a destination. leadTo dropped
  //    so she doesn't try to walk into empty space. --
  { kind: 'stone_hut', id: 'lys.hut.upper-right', position: [18, -22], rotation: -0.3, scale: 0.9 },
  {
    kind: 'boble_npc',
    id: 'lys.boble.bobble',
    position: [28, -16],
    dialogue: [
      { text: 'Oh, a fresh face. The lights felt it before I did.' },
      { text: "I'm Bobble. I don't have legs. Just opinions, and wind." },
      { action: true, text: 'tilts, drifts a hand-width sideways, drifts back' },
      {
        text: 'So the digger gave you the key. They give it to most. I never asked why.',
      },
      {
        text: "Take it north. The clearing thins out up there. You'll see what they meant.",
      },
    ],
  },
  // -- Hut surroundings. --
  { kind: 'glowing_purple_coral', id: 'lys.coral.hut.a', position: [12, -10], scale: 1.0 },
  { kind: 'purple_coral', id: 'lys.coral.hut.b', position: [24, -10], scale: 1.1 },
  { kind: 'purple_coral_alt', id: 'lys.coral.hut.c', position: [22, -28], scale: 0.95 },
  { kind: 'purple_stone_cairn', id: 'lys.cairn.hut.a', position: [10, -28], scale: 1.0 },
  { kind: 'purple_stone_cairn', id: 'lys.cairn.hut.b', position: [25, -18], scale: 0.7 },
  { kind: 'tangled_root_sculpture', id: 'lys.roots.hut', position: [32, -22], scale: 1.0, rotation: -0.7 },

  // -- North-west cluster. --
  { kind: 'rock_stack', id: 'lys.rock.nw.a', position: [-26, -12], scale: 1.0 },
  { kind: 'rock_stack', id: 'lys.rock.nw.b', position: [-36, -22], scale: 0.85, rotation: 0.5 },
  { kind: 'purple_stone_cairn', id: 'lys.cairn.nw.a', position: [-32, -8], scale: 1.1 },
  { kind: 'purple_stone_cairn', id: 'lys.cairn.nw.b', position: [-40, -2], scale: 0.85 },
  { kind: 'tangled_root_sculpture', id: 'lys.roots.nw', position: [-22, -28], scale: 1.3, rotation: 0.6 },
  { kind: 'glowing_purple_coral', id: 'lys.coral.nw', position: [-30, -18], scale: 1.1 },
  { kind: 'purple_coral', id: 'lys.coral.nw.b', position: [-38, -12], scale: 0.95 },

  // -- North arc (above the spawn) — fills the gap between spawn
  //    and the boundary so the player isn't staring at bare ground
  //    when they look due north. --
  { kind: 'neon_vascular_tree', id: 'lys.tree.north', position: [4, -32], scale: 1.3, rotation: 0.2 },
  { kind: 'tangled_root_sculpture', id: 'lys.roots.north', position: [-6, -28], scale: 1.1, rotation: 0.4 },
  { kind: 'glowing_purple_coral', id: 'lys.coral.north', position: [-16, -32], scale: 1.0 },
  { kind: 'purple_stone_cairn', id: 'lys.cairn.north', position: [10, -36], scale: 0.9 },

  // -- Decorative natural props peppered around Hagen. --
  { kind: 'neon_vascular_tree', id: 'lys.tree.a', position: [-18, 4], scale: 1.2, rotation: 0.4 },
  { kind: 'neon_vascular_tree', id: 'lys.tree.b', position: [32, -8], scale: 1.0, rotation: -0.2 },
  { kind: 'trilo', id: 'lys.trilo.a', position: [-15, 8], scale: 1.3, rotation: 0.8, color: '#a456c8', emissive: '#2a1140' },
  { kind: 'trilo', id: 'lys.trilo.b', position: [10, 12], scale: 1.1, rotation: -1.1, color: '#bf5fd8', emissive: '#321252' },
  { kind: 'trilo', id: 'lys.trilo.c', position: [22, 4], scale: 1.0, rotation: 0.3, color: '#9c4fb8', emissive: '#220a35' },

  // -- Trail markers continuing south from spawn (lead toward the
  //    south boundary — kept for visual variety even though the
  //    main path is now NORTH to the portal). --
  trailCairn('trail.a', 2, 14),
  trailCairn('trail.b', -2, 24),
];

// World-coord-only content: the chain elements (artefact, portal),
// the cairn trail north, the perimeter ring, and the orbiting skate.
// Each authored at the actual position the runtime sees.
const HAGEN_WORLD_SPAWNS: Spawn[] = [
  // Hagen's hidden artefact — tucked into the NW corner, off the
  // straight north path. Walking right past the digger toward the
  // portal won't find it; the player has to deviate.
  {
    kind: 'artifact',
    id: 'chain.artifact.lysningen',
    position: [-32, -55],
    region: 'lysningen',
  },
  // Portal to Blodverden: due NORTH of spawn, beyond the lysningen
  // content belt. The digger gestures "all the way in" toward this.
  {
    kind: 'portal',
    id: 'chain.portal.blod',
    position: [0, -90],
    targetRegion: 'blod',
    requiredKey: 'blod',
    colorA: '#ff8a8a',
    colorB: '#5a0408',
    // Animated GIF — three.js's useTexture only decodes the first
    // frame, so this currently shows as a static image.
    texture: '/Portal_____3.gif',
  },
  // Cairn breadcrumb leading north from spawn to the portal. Five
  // small cairns alternated x=±5 so they mark the path without
  // sitting on the player's straight-line walk.
  { kind: 'purple_stone_cairn', id: 'chain.trail.lys.a', position: [-5, -30], scale: 0.55 },
  { kind: 'purple_stone_cairn', id: 'chain.trail.lys.b', position: [5, -45], scale: 0.55 },
  { kind: 'purple_stone_cairn', id: 'chain.trail.lys.c', position: [-5, -60], scale: 0.6 },
  { kind: 'purple_stone_cairn', id: 'chain.trail.lys.d', position: [5, -72], scale: 0.6 },
  { kind: 'purple_stone_cairn', id: 'chain.trail.lys.e', position: [-5, -84], scale: 0.7 },
  // Stingray ambient creature drifting on a wide loop over the centre.
  {
    kind: 'skate',
    id: 'skate.clearing.orbit',
    position: [0, -2],
    radius: 10,
    height: 4,
    period: 16,
    scale: 1.0,
  },
];

// Final exported array — BASE_SPAWNS scaled to runtime, plus the
// world-coord chain + skate, plus the perimeter ring.
export const HAGEN_SPAWNS: Spawn[] = [
  ...applyWorldScale(BASE_SPAWNS),
  ...HAGEN_WORLD_SPAWNS,
  ...perimeterRing(),
];

// Player spawn point inside Hagen — keeps the original world origin
// so all the existing per-prop positions still frame correctly.
export const HAGEN_SPAWN_POINT: { x: number; z: number } = { x: 0, z: 0 };
