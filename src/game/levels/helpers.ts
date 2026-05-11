// Shared helpers for per-world spawn lists. Live separately so each
// world file can compose them without re-importing every type.

import { WORLD_RADIUS } from '../regions';
import type { BobleNpcSpawn, ScenerySpawn, Spawn } from './types';

// World-scale multiplier for "logical" coordinates. Lets a world file
// keep readable per-prop positions in a 60-radius design frame; the
// per-world array assembly multiplies everything through to the
// 120-radius runtime frame in one place.
export const WORLD_SCALE = 2;

// Trail-marker helper. Doubles as plant-exclusion bubbles so the
// path stays visibly clear even though we don't paint a real ground
// trail. Pseudo-random rotation per coord keeps the line of cairns
// from looking mechanically uniform. Coordinates are in BASE units;
// the WORLD_SCALE multiplier is applied at array assembly.
export function trailCairn(id: string, x: number, z: number, scale = 0.7): ScenerySpawn {
  return {
    kind: 'purple_stone_cairn',
    id,
    position: [x, z],
    scale,
    rotation: ((x * 7 + z * 13) % 6) - 3,
  };
}

// Multiplies every spawn position (and Bobble leadTo) by WORLD_SCALE
// at array-assembly time. Lets per-world files keep their readable
// "logical" coordinates while the actual game world stretches.
export function applyWorldScale(spawns: Spawn[]): Spawn[] {
  return spawns.map((s) => {
    const scaled: Spawn = {
      ...s,
      position: [s.position[0] * WORLD_SCALE, s.position[1] * WORLD_SCALE],
    };
    if (s.kind === 'boble_npc' && s.leadTo) {
      (scaled as BobleNpcSpawn).leadTo = [
        s.leadTo[0] * WORLD_SCALE,
        s.leadTo[1] * WORLD_SCALE,
      ];
    }
    return scaled;
  });
}

// Perimeter ring: stones around radius BOUNDARY_RING_R (just inside
// the player clamp at WORLD_RADIUS). 28 stones around the full
// circumference, with a southern gap. Mixes rock_stack,
// purple_stone_cairn, and tangled_root sculpture so the ring reads
// as a natural cluster rather than a fence. Already in WORLD
// coordinates — not run through applyWorldScale.
//
// Per-world: this is currently used by Hagen only. Empty worlds rely
// on the WORLD_RADIUS clamp in Character.tsx with no visible fence.
const BOUNDARY_RING_R = WORLD_RADIUS - 4;
export function perimeterRing(): Spawn[] {
  const out: Spawn[] = [];
  const count = 28;
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2;
    const r = BOUNDARY_RING_R + (((i * 31) % 7) - 3) * 0.6;
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    const angDeg = (a * 180) / Math.PI;
    const isSouthGate = angDeg > 82 && angDeg < 98;
    if (isSouthGate) continue;
    const kind: ScenerySpawn['kind'] | 'rock_stack' =
      i % 3 === 0
        ? 'rock_stack'
        : i % 3 === 1
          ? 'purple_stone_cairn'
          : 'tangled_root_sculpture';
    if (kind === 'rock_stack') {
      out.push({
        kind: 'rock_stack',
        id: `boundary.${i}`,
        position: [x, z],
        scale: 1.1 + ((i * 17) % 5) * 0.08,
        rotation: ((i * 0.7) % (Math.PI * 2)) - Math.PI,
      });
    } else {
      out.push({
        kind,
        id: `boundary.${i}`,
        position: [x, z],
        scale: 1.2 + ((i * 11) % 5) * 0.09,
        rotation: ((i * 1.3) % (Math.PI * 2)) - Math.PI,
      });
    }
  }
  return out;
}
