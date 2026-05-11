// Flisverden — third world. Empty blank slate, painted by the
// GEOMETRI region palette (sharp B/W with electric cyan accents).

import { getRegion } from '../../regions';
import type { Spawn } from '../types';

export const FLISVERDEN_SPAWNS: Spawn[] = [];

const center = getRegion('geometri').center;
export const FLISVERDEN_SPAWN_POINT: { x: number; z: number } = {
  x: center[0],
  z: center[1],
};
