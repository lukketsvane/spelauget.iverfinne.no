import type * as THREE from 'three';

// Module-level collider registry. Static props (huts, rocks, trilos)
// register their world-space circle on mount and unregister on
// unmount. Character.tsx calls `resolve()` each frame to push its
// position out of any overlap. Plain map (not zustand) — collision is
// a per-frame side effect, no React reactivity needed.

type Entry = { x: number; z: number; r: number };

const entries = new Map<string, Entry>();

export const collision = {
  register(id: string, x: number, z: number, r: number) {
    entries.set(id, { x, z, r });
  },
  unregister(id: string) {
    entries.delete(id);
  },
  // Push a Vector3 out of any colliding circle by adjusting x/z in
  // place. Two passes catches the common case of the player sliding
  // between two colliders that both push at once.
  resolve(out: THREE.Vector3, playerR: number) {
    for (let pass = 0; pass < 2; pass++) {
      let moved = false;
      for (const e of entries.values()) {
        const dx = out.x - e.x;
        const dz = out.z - e.z;
        const distSq = dx * dx + dz * dz;
        const minDist = e.r + playerR;
        if (distSq < minDist * minDist) {
          const dist = Math.sqrt(distSq);
          if (dist < 1e-4) {
            // Exactly on top — pick an arbitrary direction.
            out.x += minDist;
          } else {
            const push = (minDist - dist) / dist;
            out.x += dx * push;
            out.z += dz * push;
          }
          moved = true;
        }
      }
      if (!moved) break;
    }
  },
};
