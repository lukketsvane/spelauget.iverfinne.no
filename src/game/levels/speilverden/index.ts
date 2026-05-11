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

const center = getRegion('senter').center;
const CX = center[0];
const CZ = center[1];

export const SPEILVERDEN_SPAWNS: Spawn[] = [
  // Mirror floor — true reflection via THREE.Reflector. Big enough
  // that the player never sees the rim within the iso frustum.
  {
    kind: 'kjeller_mirror',
    id: 'kjeller.mirror.floor',
    position: [CX, CZ],
    width: 240,
    depth: 240,
    color: '#ffffff',
    resolution: 1024,
  },
  // Floating heart-wing monument hovering high above the mirror so
  // the player sees both the monument AND its inverted reflection in
  // the floor — confirms the mirror is doing real planar reflection.
  {
    kind: 'blod_sprite',
    id: 'kjeller.heart.monument',
    position: [CX, CZ - 6],
    texture: '/blod_verden/Frame 17.png',
    height: 14,
    yOffset: 6,
    glow: 0.8,
    tint: '#ffe6ff',
    noCollide: true,
  },
  // A pair of moths circling at chest height — adds movement to the
  // reflection so the mirror feels alive rather than static.
  {
    kind: 'blod_sprite',
    id: 'kjeller.moth.a',
    position: [CX - 6, CZ + 4],
    texture: '/blod_verden/Møll 1.png',
    height: 2.6,
    yOffset: 3.0,
    glow: 0.7,
    tint: '#cce8ff',
    noCollide: true,
  },
  {
    kind: 'blod_sprite',
    id: 'kjeller.moth.b',
    position: [CX + 7, CZ + 2],
    texture: '/blod_verden/Møll 1.png',
    height: 2.4,
    yOffset: 4.0,
    glow: 0.7,
    tint: '#d8dcff',
    noCollide: true,
  },
];

export const SPEILVERDEN_SPAWN_POINT: { x: number; z: number } = {
  x: CX,
  z: CZ,
};
