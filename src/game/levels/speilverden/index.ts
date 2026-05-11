// Kjellerverden — fifth world (folder name speilverden kept for legacy
// routing). Spawn list authored in Blender; see
// /blender/levels/speilverden.blend and /blender/README.md.

import { loadLevel } from '../loader';
import data from './spawns.json';

const level = loadLevel(data);

export const SPEILVERDEN_SPAWNS = level.spawns;
export const SPEILVERDEN_SPAWN_POINT = level.spawnPoint;
