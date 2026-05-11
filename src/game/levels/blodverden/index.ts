// Blodverden — second world. Empty blank slate, painted by the
// BLOD region palette (B/W/grey + thin red glow).
//
// Per the user's "we're building in Blender first" brief: NO
// geometry is placed here yet. Once the Blender blockout is
// finalised and exported, spawn entries will live in this array.

import { getRegion } from '../../regions';
import type { Spawn } from '../types';

export const BLODVERDEN_SPAWNS: Spawn[] = [];

const center = getRegion('blod').center;
export const BLODVERDEN_SPAWN_POINT: { x: number; z: number } = {
  x: center[0],
  z: center[1],
};
