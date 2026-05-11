// Blodverden — second world. BLOD palette (dusty rose ground, deep
// reds, cool blue-violet halo). Sparse battlefield-graveyard built
// from the painted blod_verden card assets: skeletal antler-plants,
// hovering moths, a heart-wing tree at the centre as the monument,
// and two portal silhouettes marking gateways. No horse — the field
// reads as quiet, abandoned, vegetal rather than animal.
//
// All plants face the iso camera flat-on (no rotation jitter) so each
// silhouette reads cleanly without tilt artifacts.

import { getRegion } from '../../regions';
import type { Spawn } from '../types';

const center = getRegion('blod').center;
const CX = center[0];
const CZ = center[1];

const PLANT = '/blod_verden/blod_plante1 1.png';
const HEART_WING = '/blod_verden/Frame 17.png';
const MOTH = '/blod_verden/Møll 1.png';
const PORTAL = '/blod_verden/portal 2.png';
const FLIS_PORTAL = '/blod_verden/flis_portal.png';

export const BLODVERDEN_SPAWNS: Spawn[] = [
  // -- Heart-wing tree at the centre. Tall and luminous so the player
  //    sees the monument from the spawn and is drawn toward it. --
  {
    kind: 'blod_sprite',
    id: 'blod.heart.center',
    position: [CX, CZ],
    texture: HEART_WING,
    height: 9,
    glow: 0.6,
    tint: '#ffe6ea',
  },

  // -- Skeletal antler-plants scattered as ground flora. All face the
  //    iso camera flat (rotationOffset = 0) so the painted silhouette
  //    reads cleanly without slanted edges. tint pulls them toward the
  //    BLOD palette so they don't read as raw white against the red. --
  {
    kind: 'blod_sprite',
    id: 'blod.plant.a',
    position: [CX - 10, CZ - 4],
    texture: PLANT,
    height: 2.4,
    tint: '#e8b8b8',
    glow: 0.35,
  },
  {
    kind: 'blod_sprite',
    id: 'blod.plant.b',
    position: [CX + 12, CZ - 8],
    texture: PLANT,
    height: 2.6,
    tint: '#f0c0c0',
    glow: 0.35,
  },
  {
    kind: 'blod_sprite',
    id: 'blod.plant.c',
    position: [CX - 16, CZ + 4],
    texture: PLANT,
    height: 2.2,
    tint: '#e0a8a8',
    glow: 0.35,
  },
  {
    kind: 'blod_sprite',
    id: 'blod.plant.d',
    position: [CX + 18, CZ + 6],
    texture: PLANT,
    height: 2.8,
    tint: '#ecb4b4',
    glow: 0.35,
  },
  {
    kind: 'blod_sprite',
    id: 'blod.plant.e',
    position: [CX - 6, CZ + 16],
    texture: PLANT,
    height: 2.1,
    tint: '#d8a0a0',
    glow: 0.35,
  },
  {
    kind: 'blod_sprite',
    id: 'blod.plant.f',
    position: [CX + 4, CZ - 18],
    texture: PLANT,
    height: 2.4,
    tint: '#e8b0b0',
    glow: 0.35,
  },
  {
    kind: 'blod_sprite',
    id: 'blod.plant.g',
    position: [CX - 20, CZ - 12],
    texture: PLANT,
    height: 2.6,
    tint: '#f0bcbc',
    glow: 0.35,
  },
  {
    kind: 'blod_sprite',
    id: 'blod.plant.h',
    position: [CX + 16, CZ - 22],
    texture: PLANT,
    height: 2.5,
    tint: '#dcacac',
    glow: 0.35,
  },
  {
    kind: 'blod_sprite',
    id: 'blod.plant.i',
    position: [CX - 4, CZ - 12],
    texture: PLANT,
    height: 2.0,
    tint: '#e4acac',
    glow: 0.35,
  },
  {
    kind: 'blod_sprite',
    id: 'blod.plant.j',
    position: [CX + 8, CZ + 14],
    texture: PLANT,
    height: 2.3,
    tint: '#e8b4b4',
    glow: 0.35,
  },
  // -- Extended scatter ring: more antler-plants spread further out
  //    from the monument so the player walks through a sparse field
  //    rather than a tight cluster. Heights and tints vary so the
  //    repeats don't read as obvious copies. --
  {
    kind: 'blod_sprite',
    id: 'blod.plant.k',
    position: [CX - 30, CZ - 4],
    texture: PLANT,
    height: 2.7,
    tint: '#f0c4c4',
    glow: 0.35,
  },
  {
    kind: 'blod_sprite',
    id: 'blod.plant.l',
    position: [CX + 28, CZ - 2],
    texture: PLANT,
    height: 2.5,
    tint: '#e4b0b0',
    glow: 0.35,
  },
  {
    kind: 'blod_sprite',
    id: 'blod.plant.m',
    position: [CX - 26, CZ + 18],
    texture: PLANT,
    height: 2.4,
    tint: '#d8a4a4',
    glow: 0.35,
  },
  {
    kind: 'blod_sprite',
    id: 'blod.plant.n',
    position: [CX + 24, CZ + 22],
    texture: PLANT,
    height: 2.8,
    tint: '#f0c8c8',
    glow: 0.35,
  },
  {
    kind: 'blod_sprite',
    id: 'blod.plant.o',
    position: [CX - 34, CZ + 10],
    texture: PLANT,
    height: 2.2,
    tint: '#e0a8a8',
    glow: 0.35,
  },
  {
    kind: 'blod_sprite',
    id: 'blod.plant.p',
    position: [CX + 32, CZ + 12],
    texture: PLANT,
    height: 2.6,
    tint: '#ecb4b4',
    glow: 0.35,
  },
  {
    kind: 'blod_sprite',
    id: 'blod.plant.q',
    position: [CX - 14, CZ + 26],
    texture: PLANT,
    height: 2.3,
    tint: '#d8a0a0',
    glow: 0.35,
  },
  {
    kind: 'blod_sprite',
    id: 'blod.plant.r',
    position: [CX + 14, CZ + 28],
    texture: PLANT,
    height: 2.5,
    tint: '#e8b8b8',
    glow: 0.35,
  },
  {
    kind: 'blod_sprite',
    id: 'blod.plant.s',
    position: [CX - 8, CZ - 28],
    texture: PLANT,
    height: 2.4,
    tint: '#e4acac',
    glow: 0.35,
  },
  {
    kind: 'blod_sprite',
    id: 'blod.plant.t',
    position: [CX + 22, CZ - 14],
    texture: PLANT,
    height: 2.7,
    tint: '#f0bcbc',
    glow: 0.35,
  },
  {
    kind: 'blod_sprite',
    id: 'blod.plant.u',
    position: [CX - 22, CZ - 22],
    texture: PLANT,
    height: 2.5,
    tint: '#dcacac',
    glow: 0.35,
  },
  {
    kind: 'blod_sprite',
    id: 'blod.plant.v',
    position: [CX + 6, CZ + 32],
    texture: PLANT,
    height: 2.3,
    tint: '#e8b0b0',
    glow: 0.35,
  },
  {
    kind: 'blod_sprite',
    id: 'blod.plant.w',
    position: [CX - 12, CZ + 10],
    texture: PLANT,
    height: 2.1,
    tint: '#d4a0a0',
    glow: 0.35,
  },
  {
    kind: 'blod_sprite',
    id: 'blod.plant.x',
    position: [CX + 10, CZ - 28],
    texture: PLANT,
    height: 2.6,
    tint: '#ecb8b8',
    glow: 0.35,
  },
  {
    kind: 'blod_sprite',
    id: 'blod.plant.y',
    position: [CX - 18, CZ + 2],
    texture: PLANT,
    height: 2.2,
    tint: '#e0a8a8',
    glow: 0.35,
  },
  {
    kind: 'blod_sprite',
    id: 'blod.plant.z',
    position: [CX + 18, CZ + 10],
    texture: PLANT,
    height: 2.4,
    tint: '#e4b0b0',
    glow: 0.35,
  },

  // -- Moths hovering above the field. Decorative — no colliders. --
  {
    kind: 'blod_sprite',
    id: 'blod.moth.center',
    position: [CX + 6, CZ - 6],
    texture: MOTH,
    height: 1.8,
    yOffset: 3.5,
    glow: 0.5,
    tint: '#cce8ff',
    noCollide: true,
  },
  {
    kind: 'blod_sprite',
    id: 'blod.moth.west',
    position: [CX - 12, CZ + 2],
    texture: MOTH,
    height: 1.5,
    yOffset: 4.5,
    glow: 0.55,
    tint: '#bcdcff',
    noCollide: true,
  },
  {
    kind: 'blod_sprite',
    id: 'blod.moth.south',
    position: [CX + 2, CZ + 10],
    texture: MOTH,
    height: 1.6,
    yOffset: 3.0,
    glow: 0.5,
    tint: '#d8ecff',
    noCollide: true,
  },

  // -- Red gothic portal arch on the north edge — the way out of the
  //    blood-field. Keeps its painted red colour (no tint), strong
  //    glow so it reads as the destination from across the clearing. --
  {
    kind: 'blod_sprite',
    id: 'blod.portal.north',
    position: [CX, CZ - 22],
    texture: PORTAL,
    height: 5.5,
    glow: 0.5,
  },

  // -- Butterfly-wing portal on the west side — secondary gate, paler
  //    and ghostlier than the red arch. Sits at a sharp angle from
  //    the main portal so the player notices it separately. --
  {
    kind: 'blod_sprite',
    id: 'blod.portal.flis',
    position: [CX - 22, CZ + 4],
    texture: FLIS_PORTAL,
    height: 4.5,
    glow: 0.45,
    tint: '#f0d6c8',
  },
];

export const BLODVERDEN_SPAWN_POINT: { x: number; z: number } = {
  // Drop the player south of the monument so the heart frames the
  // iso camera view on arrival.
  x: CX,
  z: CZ + 18,
};
