'use client';

import { useLevel } from '@/store/level';

// Cinematic black curtain for portal teleports. Driven entirely by
// useLevel.transitionPhase:
//   'idle' → unmounted (no DOM, no animation cost)
//   'out'  → fades from transparent to fully black (1.4 s)
//   'in'   → fades from fully black back to transparent (1.4 s)
// The actual level swap happens in the store at the boundary between
// 'out' and 'in', i.e. while the screen is fully covered, so the player
// never sees the world pop.
//
// Pointer-events are blocked during the fade so the player can't bow
// at a portal in the new level the instant it appears.
export default function TeleportOverlay() {
  const phase = useLevel((s) => s.transitionPhase);
  if (phase === 'idle') return null;

  const cls =
    phase === 'out'
      ? 'animate-teleport-fade-out'
      : 'animate-teleport-fade-in';

  return <div className={`absolute inset-0 z-[70] bg-black ${cls}`} />;
}
