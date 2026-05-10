import * as THREE from 'three';

// Module-level collider registry. Static props (huts, rocks, trilos,
// cars, relics) register their world-space footprint on mount and
// unregister on unmount. Character.tsx calls `resolve()` each frame to
// push its position out of any overlap. Plain map (not zustand) —
// collision is a per-frame side effect, no React reactivity needed.
//
// Two collider shapes are supported so each prop's footprint matches
// what the player actually sees on screen:
//
//   - Circle: cheap radial check. Used for round-ish props (rocks,
//     trilos) where every approach angle should feel the same.
//
//   - Box (oriented bounding box / OBB): rectangle with arbitrary
//     Y-rotation. Used for clearly rectangular props (huts, cars,
//     relic cards). Resolves circle-vs-OBB by clamping the player's
//     position into the OBB's local frame, finding the closest box
//     edge, and pushing the player out along the perpendicular.
//
// Both are derived per-prop from the actual rendered mesh's world
// AABB (see `registerMeshCollider` below) so a tiny GLB doesn't get
// the same fixed radius as a hut.

type CircleEntry = { kind: 'circle'; cx: number; cz: number; r: number };
type BoxEntry = {
  kind: 'box';
  cx: number;
  cz: number;
  hx: number;
  hz: number;
  rot: number; // Y-rotation of the box's local frame.
};
type Entry = CircleEntry | BoxEntry;

const entries = new Map<string, Entry>();

export const collision = {
  registerCircle(id: string, cx: number, cz: number, r: number) {
    entries.set(id, { kind: 'circle', cx, cz, r });
  },
  // hx / hz are HALF-extents along the box's local X / Z axes, before
  // rotation. `rot` is the Y-rotation that takes local → world.
  registerBox(
    id: string,
    cx: number,
    cz: number,
    hx: number,
    hz: number,
    rot: number,
  ) {
    entries.set(id, { kind: 'box', cx, cz, hx, hz, rot });
  },
  unregister(id: string) {
    entries.delete(id);
  },
  // Push a Vector3 out of any colliding entry by adjusting x/z in
  // place. Two passes catches the common case of the player sliding
  // between two colliders that both push at once.
  resolve(out: THREE.Vector3, playerR: number) {
    for (let pass = 0; pass < 2; pass++) {
      let moved = false;
      for (const e of entries.values()) {
        if (e.kind === 'circle') {
          if (resolveCircle(out, playerR, e)) moved = true;
        } else {
          if (resolveBox(out, playerR, e)) moved = true;
        }
      }
      if (!moved) break;
    }
  },
};

function resolveCircle(
  out: THREE.Vector3,
  playerR: number,
  c: CircleEntry,
): boolean {
  const dx = out.x - c.cx;
  const dz = out.z - c.cz;
  const distSq = dx * dx + dz * dz;
  const minDist = c.r + playerR;
  if (distSq >= minDist * minDist) return false;
  const dist = Math.sqrt(distSq);
  if (dist < 1e-4) {
    // Exactly on top — pick an arbitrary direction.
    out.x += minDist;
    return true;
  }
  const push = (minDist - dist) / dist;
  out.x += dx * push;
  out.z += dz * push;
  return true;
}

function resolveBox(out: THREE.Vector3, playerR: number, b: BoxEntry): boolean {
  // Translate the player's centre into the OBB's local frame.
  const dx = out.x - b.cx;
  const dz = out.z - b.cz;
  const c = Math.cos(-b.rot);
  const s = Math.sin(-b.rot);
  const lx = dx * c - dz * s;
  const lz = dx * s + dz * c;

  // Closest point on the local AABB to the local circle centre.
  const clx = Math.max(-b.hx, Math.min(b.hx, lx));
  const clz = Math.max(-b.hz, Math.min(b.hz, lz));

  // Vector from closest point to circle centre, still in local frame.
  let nx = lx - clx;
  let nz = lz - clz;
  const distSq = nx * nx + nz * nz;
  const playerSq = playerR * playerR;
  if (distSq >= playerSq) return false;

  let pushDist: number;
  const dist = Math.sqrt(distSq);
  if (dist < 1e-4) {
    // Player centre is INSIDE the box. Eject along the shortest exit
    // axis (left / right / down / up edge of the local AABB).
    const distLeft = b.hx + lx;
    const distRight = b.hx - lx;
    const distDown = b.hz + lz;
    const distUp = b.hz - lz;
    const minP = Math.min(distLeft, distRight, distDown, distUp);
    if (minP === distLeft) {
      nx = -1;
      nz = 0;
    } else if (minP === distRight) {
      nx = 1;
      nz = 0;
    } else if (minP === distDown) {
      nx = 0;
      nz = -1;
    } else {
      nx = 0;
      nz = 1;
    }
    pushDist = minP + playerR;
  } else {
    nx /= dist;
    nz /= dist;
    pushDist = playerR - dist;
  }

  // Rotate the local push back into world coords.
  const wc = Math.cos(b.rot);
  const ws = Math.sin(b.rot);
  const wx = nx * wc - nz * ws;
  const wz = nx * ws + nz * wc;
  out.x += wx * pushDist;
  out.z += wz * pushDist;
  return true;
}

// ----- Mesh-derived collider helper ---------------------------------
//
// Computes a tight OBB or circle from the actual rendered mesh and
// registers it under `id`. Call from a useEffect after the prop's
// outer group is mounted; the helper handles snapshotting / restoring
// the rotation so the box extents are measured in the un-rotated local
// frame and then rotated back for collision.
//
// `kind = 'auto'` picks circle for roughly square footprints and box
// for elongated ones (aspect ratio > ~1.4). Override with 'circle' or
// 'box' for shapes you know shouldn't be auto-detected.

const _box3 = new THREE.Box3();

export function registerMeshCollider(
  id: string,
  group: THREE.Object3D,
  rotationY: number,
  kind: 'auto' | 'circle' | 'box' = 'auto',
  options?: {
    // Pad / shrink the derived footprint. <1 makes it tighter (lets the
    // player approach closer to the visible edge), >1 makes it looser.
    inflate?: number;
  },
): () => void {
  const inflate = options?.inflate ?? 1;

  // Snapshot rotation, force to identity so the world AABB measures
  // the un-rotated mesh extents, then restore. Both reads/writes hit
  // the same group ref before the next render frame, so there's no
  // visible flicker.
  const savedY = group.rotation.y;
  group.rotation.y = 0;
  group.updateWorldMatrix(true, true);
  _box3.makeEmpty();
  _box3.setFromObject(group);
  group.rotation.y = savedY;
  group.updateWorldMatrix(true, true);

  if (_box3.isEmpty()) {
    // Bounds couldn't be computed (model still loading?) — register a
    // tiny fallback so the prop isn't entirely passable.
    const px = group.position.x;
    const pz = group.position.z;
    collision.registerCircle(id, px, pz, 0.5);
    return () => collision.unregister(id);
  }

  // Half-extents along world X / Z (un-rotated).
  const hx = ((_box3.max.x - _box3.min.x) / 2) * inflate;
  const hz = ((_box3.max.z - _box3.min.z) / 2) * inflate;

  // Un-rotated box centre in world coords.
  const cx0 = (_box3.min.x + _box3.max.x) / 2;
  const cz0 = (_box3.min.z + _box3.max.z) / 2;

  // Apply the prop's rotation: the visible mesh rotates around its
  // own group origin (group.position), so the box centre rotates
  // with it.
  const px = group.position.x;
  const pz = group.position.z;
  const lx = cx0 - px;
  const lz = cz0 - pz;
  const c = Math.cos(savedY);
  const s = Math.sin(savedY);
  const wcx = px + lx * c - lz * s;
  const wcz = pz + lx * s + lz * c;

  // Auto-detect: square-ish → circle, elongated → box.
  const aspect = Math.max(hx, hz) / Math.max(1e-4, Math.min(hx, hz));
  const resolved =
    kind === 'auto' ? (aspect > 1.4 ? 'box' : 'circle') : kind;

  if (resolved === 'circle') {
    // Average of the two half-extents reads as a tight circle that
    // matches the visual silhouette of round-ish props.
    const r = (hx + hz) / 2;
    collision.registerCircle(id, wcx, wcz, r);
  } else {
    collision.registerBox(id, wcx, wcz, hx, hz, savedY);
  }

  return () => collision.unregister(id);
}
