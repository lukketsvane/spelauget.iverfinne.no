// Tweakables in one place so the look/feel is easy to dial in.

export const CAMERA = {
  // Classic isometric: equal X and Z offsets so the angle is 45° in plan,
  // with a generous Y to look down at ~35°. Offsets are added to the character.
  offset: { x: 12, y: 14, z: 12 },
  // Larger = zoomed out. Tuned for the screenshot framing.
  viewSize: 14,
  // 0..1 — how snappy the camera follow is. 0.12 ≈ smooth but responsive.
  followLerp: 0.12,
} as const;

export const CHARACTER = {
  // World units per second.
  walkSpeed: 3.0,
  runSpeed: 5.5,
  // How fast the character turns toward the move direction (rad/sec).
  turnSpeed: 12,
  // Animation crossfade time.
  fadeSeconds: 0.18,
} as const;

// Animation roles are picked at runtime by clip duration in Character.tsx
// (shortest = run, middle = walk, longest = idle). The GLB's NLA tracks are
// named generically ("NlaTrack", "NlaTrack.001", …) so name-mapping isn't
// reliable across re-exports. Open the browser console — Character logs the
// resolved mapping on mount.

export const STARFISH_URL = '/models/starfish.glb';
