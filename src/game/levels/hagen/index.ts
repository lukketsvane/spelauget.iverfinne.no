// Hagen — first world, the garden / clearing the player wakes up in.
// Spawn list is exported from Blender: edit
// /blender/levels/hagen.blend, hit "Spelauget → Export Level", and
// spawns.json gets overwritten. Dialogue trees for the two NPCs
// live in dialogue.ts and get merged in by spawn id at load time.

import { loadLevel } from '../loader';
import { HAGEN_DIALOGUE } from './dialogue';
import data from './spawns.json';

const level = loadLevel(data, HAGEN_DIALOGUE);

export const HAGEN_SPAWNS = level.spawns;
export const HAGEN_SPAWN_POINT = level.spawnPoint;
