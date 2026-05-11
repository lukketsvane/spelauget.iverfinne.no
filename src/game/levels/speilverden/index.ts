// Speilverden — fifth world (the destination). Empty blank slate,
// painted by the SENTER region palette (golden mandala). When the
// ending logic ships, this is where the artefact-bitmask is read
// and one of the possible end-states renders.

import { getRegion } from '../../regions';
import type { Spawn } from '../types';

export const SPEILVERDEN_SPAWNS: Spawn[] = [];

const center = getRegion('senter').center;
export const SPEILVERDEN_SPAWN_POINT: { x: number; z: number } = {
  x: center[0],
  z: center[1],
};
