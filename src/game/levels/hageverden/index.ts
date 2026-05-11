// Hageverden — first world, the garden / clearing the player wakes up
// in. Spawn list is exported from Blender: edit
// /blender/levels/hageverden.blend, hit "Spelauget → Export Level", and
// spawns.json gets overwritten. Dialogue trees for the two NPCs
// live in dialogue.ts and get merged in by spawn id at load time.

import { loadLevel } from '../loader';
import { HAGEVERDEN_DIALOGUE } from './dialogue';
import data from './spawns.json';

const level = loadLevel(data, HAGEVERDEN_DIALOGUE);

export const HAGEVERDEN_SPAWNS = level.spawns;
export const HAGEVERDEN_SPAWN_POINT = level.spawnPoint;
