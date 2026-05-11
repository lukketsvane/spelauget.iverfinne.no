// Saltverden — fourth world. SISTE palette: desaturated olive →
// silver → bone ivory.
//
// Each world should source its painted-card / GLB assets from its own
// public/ folder (see ASSET_DIR below). Saltverden currently has no
// dedicated art yet, so the spawn list is intentionally minimal — a
// single key pickup so the chain stays unlockable. Drop saltverden-
// specific PNGs/GLBs into `public/saltverden/` and wire them in here
// once they exist.

import { getRegion } from '../../regions';
import type { Spawn } from '../types';

// Folder convention: every world reads its painted-card / GLB
// assets from /public/<this-world>/. Don't reach into other
// worlds' folders — keeps each region's content self-contained
// and makes asset audits trivial.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const ASSET_DIR = '/saltverden/';

const center = getRegion('siste').center;
const CX = center[0];
const CZ = center[1];

export const SALTVERDEN_SPAWNS: Spawn[] = [
  // Portal key for Kjellerverden — the last hop in the chain.
  {
    kind: 'key',
    id: 'salt.key.senter',
    position: [CX + 4, CZ + 2],
    opens: 'senter',
  },
];

export const SALTVERDEN_SPAWN_POINT: { x: number; z: number } = {
  x: CX,
  z: CZ,
};
