// Blodverden — second world. Spawn list lives in spawns.json and is
// authored in Blender (/blender/levels/blodverden.blend). No NPC
// dialogue trees for this world, so we pass an empty merge map.

import { loadLevel } from '../loader';
import data from './spawns.json';

const level = loadLevel(data);

export const BLODVERDEN_SPAWNS = level.spawns;
export const BLODVERDEN_SPAWN_POINT = level.spawnPoint;
