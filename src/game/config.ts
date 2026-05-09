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

// The GLB ships with Blender NLA tracks named generically. Map them to roles
// here; tweak indices/names if the bank order changes.
//   "NlaTrack"     6.00s  → idle (long, calm cycle)
//   "NlaTrack.001" 2.25s  → walk
//   "NlaTrack.002" 2.38s  → run
//   "NlaTrack.003" 6.00s  → extra (action / cheer)
export const ANIM = {
  idle: 'NlaTrack',
  walk: 'NlaTrack.001',
  run: 'NlaTrack.002',
  extra: 'NlaTrack.003',
} as const;

export const STARFISH_URL = '/models/starfish.glb';
