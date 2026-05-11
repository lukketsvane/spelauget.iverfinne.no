// Blodverden — second world, the blood chamber. Reference mood:
// figures rising out of red mist on near-black ground, faces /
// edges catching pink-red highlights. Composition mirrors the
// reference: two pillars of remnants flanking the player's spawn
// point, smaller silhouettes receding into the fog behind.
//
// All positions are world coords (no applyWorldScale) and centred
// around the BLOD region centre at [-90, -50] from regions.ts.
// Player spawns at the same point so they wake up looking THROUGH
// the flanking pillars toward the back of the chamber.

import { getRegion } from '../../regions';
import type { Spawn } from '../types';

const center = getRegion('blod').center;
const cx = center[0]; // -90
const cz = center[1]; // -50

// Flanking pillars: tallest remnants placed close to the player on
// both sides. The reference shows two huge silhouettes framing
// stairs going up — these mimic that feel. Tall heights so the
// silhouettes tower over the player.
const FLANK_LEFT_X = cx - 9;
const FLANK_RIGHT_X = cx + 9;

export const BLODVERDEN_SPAWNS: Spawn[] = [
  // ── Inner flanking pillars (closest to spawn, tallest) ────────────
  {
    kind: 'remnant',
    id: 'blod.flank.left.tall',
    position: [FLANK_LEFT_X, cz - 4],
    texture: '/blod_verden/remnant_03.png',
    height: 9.5,
    rotationOffset: 0.05,
  },
  {
    kind: 'remnant',
    id: 'blod.flank.right.tall',
    position: [FLANK_RIGHT_X, cz - 4],
    texture: '/blod_verden/remnant_06.png',
    height: 9.5,
    rotationOffset: -0.05,
  },

  // ── Mid pillars (slightly behind, medium height) ──────────────────
  {
    kind: 'remnant',
    id: 'blod.mid.left',
    position: [cx - 14, cz - 14],
    texture: '/blod_verden/remnant_01.png',
    height: 7.5,
    rotationOffset: 0.2,
  },
  {
    kind: 'remnant',
    id: 'blod.mid.right',
    position: [cx + 14, cz - 14],
    texture: '/blod_verden/remnant_04.png',
    height: 7.5,
    rotationOffset: -0.2,
  },

  // ── Far pillars (deeper into fog, shorter) ────────────────────────
  {
    kind: 'remnant',
    id: 'blod.far.left',
    position: [cx - 6, cz - 24],
    texture: '/blod_verden/remnant_02.png',
    height: 6.0,
    rotationOffset: 0.3,
  },
  {
    kind: 'remnant',
    id: 'blod.far.right',
    position: [cx + 6, cz - 24],
    texture: '/blod_verden/remnant_05.png',
    height: 6.0,
    rotationOffset: -0.3,
  },
  {
    kind: 'remnant',
    id: 'blod.far.center',
    position: [cx, cz - 32],
    texture: '/blod_verden/remnant_07.png',
    height: 7.0,
    rotationOffset: 0.0,
  },

  // ── Behind-the-player silhouette: one figure at the player's back
  //    so when they turn around the chamber feels surrounded, not
  //    a one-way diorama. ──────────────────────────────────────────
  {
    kind: 'remnant',
    id: 'blod.back.center',
    position: [cx, cz + 16],
    texture: '/blod_verden/remnant_08.png',
    height: 6.5,
    rotationOffset: 0.4,
  },

  // ── Ground flora — small painted tiles for foreground texture so
  //    the chamber floor isn't bare. The Remnant component renders
  //    these as small flat-card billboards; the BLOD relic palette
  //    tints them blood-red. ─────────────────────────────────────
  {
    kind: 'remnant',
    id: 'blod.flora.blomst.a',
    position: [cx - 4, cz + 6],
    texture: '/blod_verden/flis_blomst1_stor.png',
    height: 2.4,
    rotationOffset: -0.15,
  },
  {
    kind: 'remnant',
    id: 'blod.flora.blomst.b',
    position: [cx + 5, cz + 8],
    texture: '/blod_verden/flis_blomst1_stor.png',
    height: 2.0,
    rotationOffset: 0.25,
  },
  {
    kind: 'remnant',
    id: 'blod.flora.vekst1.a',
    position: [cx - 7, cz - 1],
    texture: '/blod_verden/flis_vekst1.png',
    height: 1.2,
    rotationOffset: 0.1,
  },
  {
    kind: 'remnant',
    id: 'blod.flora.vekst1.b',
    position: [cx + 7, cz - 1],
    texture: '/blod_verden/flis_vekst1.png',
    height: 1.4,
    rotationOffset: -0.3,
  },
  {
    kind: 'remnant',
    id: 'blod.flora.vekst2.a',
    position: [cx - 2, cz - 9],
    texture: '/blod_verden/flis_vekst2.png',
    height: 1.6,
    rotationOffset: 0.4,
  },
  {
    kind: 'remnant',
    id: 'blod.flora.vekst2.b',
    position: [cx + 3, cz - 9],
    texture: '/blod_verden/flis_vekst2.png',
    height: 1.3,
    rotationOffset: -0.5,
  },
  {
    kind: 'remnant',
    id: 'blod.flora.vekst3.a',
    position: [cx - 11, cz + 4],
    texture: '/blod_verden/flis_vekst3.png',
    height: 1.7,
    rotationOffset: 0.2,
  },
  {
    kind: 'remnant',
    id: 'blod.flora.vekst3.b',
    position: [cx + 11, cz + 4],
    texture: '/blod_verden/flis_vekst3.png',
    height: 1.5,
    rotationOffset: -0.7,
  },
];

// Player spawn point inside Blodverden — centre of the flanking
// pillars so the iso camera frames the chamber the way the
// reference image does. Z offset slightly south of the centre so
// the back-silhouette (cz + 16) is visible behind on first frame.
export const BLODVERDEN_SPAWN_POINT: { x: number; z: number } = {
  x: cx,
  z: cz + 4,
};
