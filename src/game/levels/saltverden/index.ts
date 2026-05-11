// Saltverden — fourth world. Empty blank slate, painted by the
// SISTE region palette (desaturated olive → bone ivory).

import { getRegion } from '../../regions';
import type { Spawn } from '../types';

export const SALTVERDEN_SPAWNS: Spawn[] = [];

const center = getRegion('siste').center;
export const SALTVERDEN_SPAWN_POINT: { x: number; z: number } = {
  x: center[0],
  z: center[1],
};
