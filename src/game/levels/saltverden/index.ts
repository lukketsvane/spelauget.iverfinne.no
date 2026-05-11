// Saltverden — fourth world. Spawn list authored in Blender; see
// /blender/levels/saltverden.blend and /blender/README.md.

import { loadLevel } from '../loader';
import data from './spawns.json';

const level = loadLevel(data);

export const SALTVERDEN_SPAWNS = level.spawns;
export const SALTVERDEN_SPAWN_POINT = level.spawnPoint;
