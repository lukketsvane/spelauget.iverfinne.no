// Flisverden — third world. Region palette is GEOMETRI (pink figures
// + baby-cyan tiles). A flat wet-tile plaza paves the entire region,
// with a single rectangular pool recessed into the middle of it. The
// player walks at deck level (the plaza surface) and looks down into
// the basin. Three giantess sculptures sit on the plaza around the
// pool — same level as the player, so the camera never gets clipped
// by a figure perched on a raised structure.

import { getRegion } from '../../regions';
import {
  POOL_TILE as TILE,
  POOL_TILES_X,
  POOL_TILES_Z,
} from '../../FlisPool';
import type { Spawn } from '../types';

const center = getRegion('geometri').center;
const CX = center[0];
const CZ = center[1];

// Pool centre offset slightly so the player's spawn south of it gives
// a clean iso framing of the basin and the nearest sculpture.
const POOL_CX = CX;
const POOL_CZ = CZ - 4;

// Pool footprint in world units.
const POOL_HALF_X = (POOL_TILES_X * TILE) / 2;
const POOL_HALF_Z = (POOL_TILES_Z * TILE) / 2;

// The whole plaza extends this far in each direction from the region
// centre. Big enough to fill the playable area without the floor
// ending visibly inside the iso camera frustum.
const PLAZA_HALF = 110;

// Tile floor is built from four strips around the pool so the basin
// reads as a literal hole in the plaza — the player looks down into
// the water instead of seeing the floor cover it.
const NORTH_DEPTH = POOL_CZ - POOL_HALF_Z - (CZ - PLAZA_HALF);
const SOUTH_DEPTH = (CZ + PLAZA_HALF) - (POOL_CZ + POOL_HALF_Z);
const SIDE_WIDTH = (CX + PLAZA_HALF) - (POOL_CX + POOL_HALF_X);

export const FLISVERDEN_SPAWNS: Spawn[] = [
  // Plaza floor — four rectangles forming a frame around the pool.
  // Each one paves the deck level (y=0) with the same wet ceramic
  // tile as the pool basin.
  {
    kind: 'flis_floor',
    id: 'flis.floor.north',
    position: [CX, POOL_CZ - POOL_HALF_Z - NORTH_DEPTH / 2],
    width: PLAZA_HALF * 2,
    depth: NORTH_DEPTH,
    tileSize: TILE,
  },
  {
    kind: 'flis_floor',
    id: 'flis.floor.south',
    position: [CX, POOL_CZ + POOL_HALF_Z + SOUTH_DEPTH / 2],
    width: PLAZA_HALF * 2,
    depth: SOUTH_DEPTH,
    tileSize: TILE,
  },
  {
    kind: 'flis_floor',
    id: 'flis.floor.east',
    position: [POOL_CX + POOL_HALF_X + SIDE_WIDTH / 2, POOL_CZ],
    width: SIDE_WIDTH,
    depth: POOL_HALF_Z * 2,
    tileSize: TILE,
  },
  {
    kind: 'flis_floor',
    id: 'flis.floor.west',
    position: [POOL_CX - POOL_HALF_X - SIDE_WIDTH / 2, POOL_CZ],
    width: SIDE_WIDTH,
    depth: POOL_HALF_Z * 2,
    tileSize: TILE,
  },

  // Sunken pool — basin recessed below the plaza with tile-clad inner
  // walls and a translucent water plane just under the rim.
  {
    kind: 'flis_pool',
    id: 'flis.pool.main',
    position: [POOL_CX, POOL_CZ],
  },

  // Three giantess sculptures on the plaza at ground level. Each is
  // a few metres outside the pool rim, rotated to face inward at the
  // water. The 11× scale keeps them monumental relative to the player
  // without the figures floating on a raised structure.
  {
    kind: 'giantess',
    id: 'flis.giantess.nw',
    position: [POOL_CX - POOL_HALF_X - 10, POOL_CZ - POOL_HALF_Z - 4],
    rotation: -Math.PI / 4,
  },
  {
    kind: 'giantess',
    id: 'flis.giantess.ne',
    position: [POOL_CX + POOL_HALF_X + 10, POOL_CZ - POOL_HALF_Z - 4],
    rotation: Math.PI + Math.PI / 4,
  },
  {
    kind: 'giantess',
    id: 'flis.giantess.n',
    position: [POOL_CX, POOL_CZ - POOL_HALF_Z - 14],
    rotation: Math.PI,
  },
];

export const FLISVERDEN_SPAWN_POINT: { x: number; z: number } = {
  // Player wakes a few metres south of the pool's south rim so the
  // basin + nearest part of a sculpture is visible in the iso frame.
  x: POOL_CX,
  z: POOL_CZ + POOL_HALF_Z + 6,
};
