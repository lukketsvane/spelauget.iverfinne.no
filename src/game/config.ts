// Tweakables in one place so the look/feel is easy to dial in.

export const CAMERA = {
  // Iso-ish: equal X/Z offsets for 45° azimuth, lower Y for a flatter pitch
  // that "sees more" of the world ahead of the player.
  offset: { x: 14, y: 11, z: 14 },
  // Larger = more world visible. Bumped up so the player can see plants
  // around them before walking into them.
  viewSize: 20,
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
  // Visual scale applied to the GLB.
  scale: 2.0,
  // Radians added to the move-direction yaw to compensate for the GLB's
  // local "forward" axis. Most rigged characters have local -Z forward, so
  // π is a common starting value. Try 0, π, ±π/2 if facing is off.
  modelForwardYaw: Math.PI,
} as const;

// Animation roles are picked at runtime by clip duration in Character.tsx
// (shortest = run, middle = walk, longest = idle). The GLB's NLA tracks are
// named generically ("NlaTrack", "NlaTrack.001", …) so name-mapping isn't
// reliable across re-exports. Open the browser console — Character logs the
// resolved mapping on mount.

export const STARFISH_URL = '/models/starfish.glb';
