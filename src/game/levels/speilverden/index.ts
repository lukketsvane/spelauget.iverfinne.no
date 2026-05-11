// Kjellerverden — fifth world. Display name swapped to "Kjellerverden"
// (the basement / cellar world). Folder still called `speilverden` so
// the rest of the routing keeps working without a rename cascade.
//
// Centre piece is a single perfect-mirror floor plane that reflects
// the scene back at the iso camera — the player walks on top of their
// own upside-down reflection. Sparse, almost-empty otherwise; this
// world reads as a contemplative still pool.

import { getRegion } from '../../regions';
import type { Spawn } from '../types';

// Folder convention: every world reads its painted-card / GLB assets
// from /public/<this-world>/. Kjellerverden has no painted art yet —
// the world is a single mirror plane — so this constant is just a
// placeholder for when sprites get added.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const ASSET_DIR = '/kjellerverden/';

const center = getRegion('senter').center;
const CX = center[0];
const CZ = center[1];

export const SPEILVERDEN_SPAWNS: Spawn[] = [
  // Mirror floor — true planar reflection via the custom ortho-friendly
  // mirror in KjellerMirror.tsx. Big enough that the player never sees
  // the rim inside the iso frustum. Intentionally the ONLY prop in
  // Kjellerverden for now — the world is a contemplative still pool
  // until further assets are designed.
  {
    kind: 'kjeller_mirror',
    id: 'kjeller.mirror.floor',
    position: [CX, CZ],
    width: 240,
    depth: 240,
    color: '#ffffff',
    resolution: 1024,
  },
];

export const SPEILVERDEN_SPAWN_POINT: { x: number; z: number } = {
  x: CX,
  z: CZ,
};
