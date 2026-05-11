// Flisverden — third world. Spawn list authored in Blender; see
// /blender/levels/flisverden.blend and /blender/README.md.

import { loadLevel } from '../loader';
import data from './spawns.json';

const level = loadLevel(data);

export const FLISVERDEN_SPAWNS = level.spawns;
export const FLISVERDEN_SPAWN_POINT = level.spawnPoint;
