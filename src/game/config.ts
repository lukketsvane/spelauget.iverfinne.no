// Tweakables in one place so the look/feel is easy to dial in.

export const CAMERA = {
  // Iso-ish: equal X/Z offsets for 45° azimuth. Y kept noticeably lower
  // than the horizontal so the pitch is flatter — the player can see more
  // of the world in the distance instead of looking straight down.
  offset: { x: 14, y: 9, z: 14 },
  // Ortho frustum height in world units. Larger = more visible world.
  viewSize: 18,
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
  // Radians added to move-direction yaw to compensate for the GLB's local
  // forward axis. Sligo's mesh has local +X as the visual front (Tripo
  // exports characters along the X axis), so we rotate -π/2 to align.
  // Try 0, π, π/2 for future models pointing along ±Z or -X.
  modelForwardYaw: -Math.PI / 2,
} as const;

// Animation roles are picked at runtime by clip duration in Character.tsx:
//   shortest                   → run
//   second-shortest            → walk
//   longest                    → idle (long, expressive cycle)
//   the remaining (4th) clip   → "extra" emote (one-shot, on demand)
// The GLB's NLA tracks come through as generic "NlaTrack[.NNN]" names, so
// name-based mapping isn't portable. Character.tsx logs the resolved
// mapping on mount — open devtools console to see it.

export const PLAYER_MODEL_URL = '/models/sligo_01.glb';

// How long the character must stay idle before a random emote fires, in
// seconds. Picks uniformly inside the range each time.
export const EMOTE_IDLE_RANGE: [number, number] = [5, 9];
